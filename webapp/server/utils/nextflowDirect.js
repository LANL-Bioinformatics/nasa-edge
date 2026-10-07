/**
 * Direct nextflow execution: the web server invokes the `nextflow` CLI itself.
 *
 * This is the original execution path, preserved for backward compatibility and
 * selected by NEXTFLOW_MODE=direct (the default). Commands may be prefixed with
 * NEXTFLOW_SLURM_SSH to reach a scheduler login node.
 *
 * Deployments that run the web server in a container without the nextflow CLI,
 * or that want durable job handles and idempotent submission, should use
 * NEXTFLOW_MODE=runner instead (see utils/nextflowRunner.js).
 */

const fs = require('fs')
const Job = require('../edge-api/models/job')
const {
  workflowList,
  generateWorkflowResult,
  zipProjectOutputs,
} = require('../workflow/util')
const { write2log, execCmd, sleep, pidIsRunning } = require('./common')
const logger = require('./logger')
const config = require('../config')

/**
 * Returns the nextflow work directory for a project.
 *
 * @param proj {object} The project document
 * @param projHome {string} The project directory
 * @return {string} The work directory
 */
const getWorkDir = (proj, projHome) =>
  config.NEXTFLOW.WORK_DIR
    ? `${config.NEXTFLOW.WORK_DIR}/${proj.code}/work`
    : `${projHome}/nextflow/work`

/**
 * Derives an overall status from `nextflow log <run> -f name,status` output.
 *
 * Task statuses are COMPLETED, FAILED, or ABORTED. Retried tasks appear more
 * than once, so the last entry for a task name wins.
 *
 * @param statusStr {string} The command output
 * @return {string} 'Succeeded', 'Failed', or 'Aborted'
 */
const getJobStatus = statusStr => {
  const lines = statusStr.split(/\n/)
  const statuses = {}
  for (let i = 0; i < lines.length; i += 1) {
    const [name, status] = lines[i].trim().split('\t')
    // skip empty line
    if (name) {
      statuses[name] = status
    }
  }
  const values = Object.values(statuses)
  // No tasks recorded is not a success.
  if (values.length === 0) return 'Failed'
  if (values.includes('ABORTED')) return 'Aborted'
  if (values.some(status => status !== 'COMPLETED')) return 'Failed'
  return 'Succeeded'
}

/**
 * Launches `nextflow run` in the background and records the job.
 *
 * The command is not awaited: a workflow can run for hours, and the process is
 * detached with -bg. updateJobStatus reconciles the outcome afterwards.
 *
 * @param proj {object} The project document
 * @param projectConf {object} The parsed project conf.json
 * @param inputsize {number} Total input size in bytes
 * @return {Promise<void>}
 */
const submitWorkflow = async (proj, projectConf, inputsize) => {
  const projHome = `${config.IO.PROJECT_BASE_DIR}/${proj.code}`
  // Run nextflow in work directory
  const nfWorkDir = getWorkDir(proj, projHome)
  fs.mkdirSync(nfWorkDir, { recursive: true })
  // in case nextflow needs permission to write to the directory
  fs.chmodSync(nfWorkDir, '777')
  if (!fs.existsSync(nfWorkDir)) {
    logger.error(`Error creating directory ${nfWorkDir}:`)
    proj.status = 'failed'
    await proj.save()
    return
  }
  // Output nextflow log, reports to <project home>/nextflow
  const nfOutDir = `${projHome}/nextflow`
  fs.mkdirSync(nfOutDir, { recursive: true })
  // in case nextflow needs permission to write to the directory
  fs.chmodSync(nfOutDir, '777')
  if (!fs.existsSync(nfOutDir)) {
    logger.error(`Error creating directory ${nfOutDir}:`)
    proj.status = 'failed'
    await proj.save()
    return
  }
  // submit workflow
  const runName = `edge-${proj.code}`
  const workflow = workflowList[projectConf.workflow.name]
  // Profile is a separate field so the runner path can pass it structurally;
  // here it has to be rendered back onto the command line.
  const profile = workflow.nextflow_profile
    ? ` -profile ${workflow.nextflow_profile}`
    : ''
  const cmd = `${config.NEXTFLOW.SLURM_SSH} NXF_CACHE_DIR=${nfWorkDir} NXF_PID_FILE=${nfOutDir}/.nextflow.pid NXF_LOG_FILE=${nfOutDir}/.nextflow.log nextflow -C ${nfOutDir}/../nextflow.config -bg -q run ${workflow.nextflow_main}${profile} -name ${runName}`

  // Don't need to wait for the command to complete. It may take long time to finish and cause an error.
  // The updateJobStatus will catch the error if this command failed.
  execCmd(cmd)
  await sleep(2000) // Wait for 2 seconds
  const newJob = new Job({
    id: runName,
    project: proj.code,
    type: proj.type,
    inputSize: inputsize,
    queue: 'nextflow',
    status: 'Running',
  })
  await newJob.save().catch(err => {
    logger.error('falied to save to nextflowjob: ', err)
  })
  proj.status = 'running'
  await proj.save()
}

/**
 * Reconciles a job by querying the nextflow log.
 *
 * @param job {object} The job document
 * @param proj {object} The project document
 * @return {Promise<void>}
 */
const updateJobStatus = async (job, proj) => {
  // get job status
  const projHome = `${config.IO.PROJECT_BASE_DIR}/${proj.code}`
  const nfWorkDir = getWorkDir(proj, projHome)
  // Pipeline status. Possible values are: OK, ERR and empty
  // set env NXF_CACHE_DIR
  let cmd = `${config.NEXTFLOW.SLURM_SSH} NXF_CACHE_DIR=${nfWorkDir} nextflow log|awk '/${job.id}/ &&(/OK/||/ERR/)'|awk '{split($0,array,/\t/); print array[4]}'`
  let ret = await execCmd(cmd)

  if (!ret || ret.code !== 0) {
    if (ret && ret.message.includes('execution history is empty')) {
      job.status = 'Failed'
      proj.status = 'failed'
      await Promise.all([job.save(), proj.save()])
      write2log(`${projHome}/log.txt`, 'Nextflow job status: failed')
    }
    // command failed
    return
  }
  // if empty, the workflow has not finished
  if (ret.message === '') {
    // workflow is still running, update job updated datetime to move job to the end of job queue
    job.updated = Date.now()
    await job.save()
    return
  }
  if (ret.message.trim() === 'ERR') {
    job.status = 'Failed'
    proj.status = 'failed'
    await Promise.all([job.save(), proj.save()])
    write2log(`${projHome}/log.txt`, 'Nextflow job status: failed')
    return
  }

  // Task status. Possible values are: COMPLETED, FAILED, and ABORTED.
  cmd = `${config.NEXTFLOW.SLURM_SSH} NXF_CACHE_DIR=${nfWorkDir} nextflow log ${job.id} -f name,status`
  ret = await execCmd(cmd)
  if (!ret || ret.code !== 0) {
    // command failed
    return
  }
  // find job status
  let newStatus = getJobStatus(ret.message)
  // update project status
  if (job.status !== newStatus) {
    if (newStatus === 'Succeeded') {
      // generate result.json
      logger.info('generate workflow result.json')
      try {
        generateWorkflowResult(proj)
        await zipProjectOutputs(proj)
        proj.status = 'complete'
      } catch (e) {
        // result not as expected: this is a failed run
        newStatus = 'Failed'
        job.error = `Result generation failed: ${e.message}`
        proj.status = 'failed'
        write2log(`${projHome}/log.txt`, `Result generation failed: ${e}`)
      }
    } else {
      proj.status = 'failed'
    }
    await proj.save()
    write2log(`${projHome}/log.txt`, `Nextflow job status: ${newStatus}`)
  }
  // update job even its status unchanged. We need set new updated time for this job.
  if (newStatus === 'Aborted') {
    // delete job
    await Job.deleteOne({ project: proj.code })
  } else {
    job.status = newStatus
    job.updated = Date.now()
    await job.save()
  }
}

/**
 * Reads the nextflow PID recorded by -bg.
 *
 * @param proj {object} The project document
 * @return {Promise<number|null>} The PID, or null when unavailable
 */
const getPid = async proj => {
  const pidFile = `${config.IO.PROJECT_BASE_DIR}/${proj.code}/nextflow/.nextflow.pid`
  if (fs.existsSync(pidFile)) {
    let all = fs.readFileSync(pidFile, 'utf8')
    all = all.trim() // final crlf in file
    const lines = all.split('\n')
    if (lines[0]) {
      return parseInt(lines[0], 10)
    }
  }
  return null
}

/**
 * Aborts a locally executed workflow by signalling its process group.
 *
 * @param proj {object} The project document
 * @return {Promise<void>}
 */
const abortJobLocal = async proj => {
  const pid = await getPid(proj)
  if (pid && pidIsRunning(pid)) {
    // Don't need to wait for the deletion, the process may already complete
    execCmd(`pkill -TERM -P ${pid}`)
  }
  // delete job
  await Job.deleteOne({ project: proj.code })
}

/**
 * Aborts a slurm-executed workflow by cancelling its scheduler jobs.
 *
 * @param proj {object} The project document
 * @return {Promise<void>}
 */
const abortJobSlurm = async proj => {
  const pid = await getPid(proj)
  if (pid) {
    // Don't need to wait for the deletion, the process may already complete
    execCmd(`${config.NEXTFLOW.SLURM_SSH} kill -9 ${pid}`)
  }
  // get slurm jobIds from .nextflow.log
  const logFile = `${config.IO.PROJECT_BASE_DIR}/${proj.code}/nextflow/.nextflow.log`
  const cmd = `grep 'Task submitter' ${logFile}|grep jobId|sed 's/.*jobId: //g'|sed 's/;.*//g'`
  const ret = await execCmd(cmd)

  if (ret && ret.code === 0) {
    // cancel each slurm job by id
    const lines = ret.message.split(/\n/)
    for (let i = 0; i < lines.length; i += 1) {
      const jobId = lines[i].trim()
      if (jobId) {
        // don't need to wait for the command to complete
        logger.info(`Aborting slurm job ${jobId} for project ${proj.code}`)
        execCmd(`${config.NEXTFLOW.SLURM_SSH} scancel ${jobId}`)
      }
    }
  }
  // delete edge job
  await Job.deleteOne({ project: proj.code })
}

/**
 * Aborts a directly executed workflow.
 *
 * @param proj {object} The project document
 * @return {Promise<void>}
 */
const abortJob = async proj => {
  if (config.NEXTFLOW.EXECUTOR === 'local') {
    await abortJobLocal(proj)
  } else if (config.NEXTFLOW.EXECUTOR === 'slurm') {
    await abortJobSlurm(proj)
  } else {
    throw Error(`Unsupported nextflow executor '${config.NEXTFLOW.EXECUTOR}'`)
  }
}

module.exports = {
  abortJob,
  getJobStatus,
  getPid,
  submitWorkflow,
  updateJobStatus,
}
