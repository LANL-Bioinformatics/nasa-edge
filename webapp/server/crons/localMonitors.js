const fs = require('fs')
const Project = require('../edge-api/models/project')
const Job = require('../edge-api/models/job')
const common = require('../utils/common')
const logger = require('../utils/logger')
const { abortJob, updateJobStatus } = require('../utils/local')
const {
  localWorkflows,
  workflowList,
  getWorkflowCommand,
  getWorkflowEnvironment,
} = require('../workflow/util')
const {
  generateJobId,
  getRunnerName,
  makeSharedDir,
  submitRunnerJob,
} = require('../utils/runner')
const {
  isPermanentRunnerError,
  runnerErrorMessage,
} = require('../utils/jobStatus')

const config = require('../config')

// Matches jobs executed outside of cromwell/nextflow, in either mode. Nextflow
// runner jobs are excluded because nextflowMonitors owns them.
// Built lazily so the query reflects configuration at call time rather than at
// module load, and so deployments that do not configure nextflow still work.
const localJobQuery = () => {
  const nextflowRunner = config.NEXTFLOW && config.NEXTFLOW.RUNNER_NAME
  return {
    $or: [
      { queue: 'local' },
      {
        queue: 'runner',
        // Exclude the nextflow runner only when one is configured; otherwise
        // every runner job here is a tool job.
        ...(nextflowRunner ? { runner: { $ne: nextflowRunner } } : {}),
      },
    ],
    status: { $in: ['Submitted', 'Running'] },
  }
}

/**
 * Requeues projects that were claimed for submission but never got a job.
 *
 * A project is set to 'processing' before its job is created. If the process
 * dies in that window the project would sit in 'processing' forever, so after a
 * grace period any such project with no job record is returned to the queue.
 *
 * @param workflows {string[]} The workflow types this monitor owns
 * @return {Promise<void>}
 */
const recoverStaleSubmissions = async workflows => {
  const staleBefore = new Date(Date.now() - config.RUNNER.SUBMISSION_STALE_MS)
  const projects = await Project.find({
    type: { $in: workflows },
    status: 'processing',
    updated: { $lt: staleBefore },
  })
  for (let i = 0; i < projects.length; i += 1) {
    const project = projects[i]
    // eslint-disable-next-line no-await-in-loop
    const jobExists = await Job.exists({ project: project.code })
    if (!jobExists) {
      project.status = 'in queue'
      logger.info(`Requeueing stale submission ${project.code}`)
      // eslint-disable-next-line no-await-in-loop
      await project.save()
    }
  }
}

/**
 * Spawns a workflow as a detached child process and records its PID.
 *
 * The original execution mode, used when LOCAL_EXECUTION_MODE=pid. The recorded
 * PID is `pid + 1` because the command is run through a shell, so the tool
 * itself is the shell's child.
 *
 * @param proj {object} The project document
 * @return {Promise<void>}
 */
const submitPidJob = async proj => {
  const projHome = `${config.IO.PROJECT_BASE_DIR}/${proj.code}`
  const projectConf = JSON.parse(fs.readFileSync(`${projHome}/conf.json`))
  const workflow = workflowList[projectConf.workflow.name]
  if (!workflow) {
    throw new Error(`Unknown workflow ${projectConf.workflow.name}`)
  }
  // in case the workflow needs permission to write to the output directory
  makeSharedDir(`${projHome}/${workflow.outdir}`)

  const runTime = `${projHome}/run_time.txt`
  const workflowCmd = getWorkflowCommand(proj)
  let cmd = `echo "${workflowCmd}" > ${projHome}/cmd.txt && date > ${runTime}`
  cmd += ` && ${workflowCmd}`
  cmd += ` && date >> ${runTime} && touch ${projHome}/.done &`
  logger.info(cmd)

  // Workflows whose toolchain is not on the server's PATH supply it here.
  const environment =
    typeof getWorkflowEnvironment === 'function'
      ? getWorkflowEnvironment(proj)
      : undefined
  const pid = common.spawnCmd(cmd, `${projHome}/log.txt`, environment)
  if (!pid) {
    throw new Error('Failed to start local process')
  }
  const newJob = new Job({
    pid: pid + 1,
    id: `local-${proj.code}`,
    project: proj.code,
    type: proj.type,
    queue: 'local',
    status: 'Running',
  })
  await newJob.save()
  proj.status = 'running'
  await proj.save()
  logger.info(`Started local job with PID: ${pid + 1}`)
}

/**
 * Submits a workflow to its job runner.
 *
 * The job document is persisted before the HTTP call; see submitWorkflow in
 * utils/nextflow.js for why.
 *
 * @param proj {object} The project document
 * @return {Promise<void>}
 */
const submitRunnerWorkflow = async proj => {
  const jobId = generateJobId(proj)
  const job = new Job({
    id: jobId,
    project: proj.code,
    type: proj.type,
    queue: 'runner',
    runner: getRunnerName(proj.type),
    status: 'Submitted',
  })
  await job.save()
  proj.status = 'submitted'
  await proj.save()

  try {
    const runnerJob = await submitRunnerJob(proj, jobId)
    logger.info(`Submitted ${proj.code} to ${job.runner} as ${runnerJob.jobId}`)
    if (runnerJob.status === 'running') {
      job.status = 'Running'
      proj.status = 'running'
    }
  } catch (error) {
    const message = runnerErrorMessage(error)
    job.error = message
    if (isPermanentRunnerError(error)) {
      job.status = 'Failed'
      proj.status = 'failed'
    }
    // Transient failures leave the job Submitted for the monitor to retry.
    logger.error(`Runner submission failed for ${proj.code}: ${message}`)
    common.write2log(
       `${config.IO.PROJECT_BASE_DIR}/${proj.code}/log.txt`,
       `Runner submission to '${job.runner}' failed: ${message}`,
    )
  }
  await Promise.all([job.save(), proj.save()])
}

const localWorkflowMonitor = async () => {
  logger.debug('Local workflow monitor')
  try {
    await recoverStaleSubmissions(localWorkflows)
    // submit request only when the current running jobs less than the max allowed jobs
    const activeJobs = await Job.countDocuments(localJobQuery())
    if (activeJobs >= config.LOCAL.NUM_JOBS_MAX) {
      logger.debug('Local server is busy.')
      return
    }
    // Claim one project atomically so concurrent monitors cannot both take it.
    const proj = await Project.findOneAndUpdate(
      { type: { $in: localWorkflows }, status: 'in queue' },
      { $set: { status: 'processing' } },
      { sort: { updated: 1 }, new: true },
    )
    if (!proj) {
      logger.debug('No local request to process')
      return
    }
    logger.info(`Processing local request: ${proj.code}`)

    try {
      if (config.LOCAL.EXECUTION_MODE === 'pid') {
        await submitPidJob(proj)
      } else {
        await submitRunnerWorkflow(proj)
      }
    } catch (error) {
      proj.status = 'failed'
      await proj.save()
      common.write2log(
        `${config.IO.PROJECT_BASE_DIR}/${proj.code}/log.txt`,
        `Submission failed: ${error.message}`,
      )
      logger.error(`Submission failed for ${proj.code}: ${error}`)
    }
  } catch (err) {
    logger.error(`localMonitor failed:${err}`)
  }
}

const localJobMonitor = async () => {
  logger.debug('local job monitor')
  try {
    // only process one job at each time based on job updated time
    const job = await Job.findOne(localJobQuery()).sort({ updated: 1 })
    if (!job) {
      logger.debug('No local job to process')
      return
    }
    logger.debug(`local job ${job.id}`)
    // find related project
    const proj = await Project.findOne({ code: job.project })
    if (!proj) {
      // Cancel the execution before discarding the only handle to it.
      await abortJob(job)
      await Job.deleteOne({ project: job.project })
    } else if (proj.status === 'delete') {
      await abortJob(job)
    } else {
      await updateJobStatus(job, proj)
    }
  } catch (err) {
    logger.error(`localJobMonitor failed:${err}`)
  }
}

module.exports = {
  localWorkflowMonitor,
  localJobMonitor,
}
