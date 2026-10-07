const fs = require('fs')
const Project = require('../edge-api/models/project')
const Job = require('../edge-api/models/job')
const {
  abortJob,
  updateJobStatus,
  generateInputs,
  submitWorkflow,
} = require('../utils/nextflow')
const common = require('../utils/common')
const logger = require('../utils/logger')
const { nextflowWorkflows, workflowList } = require('../workflow/util')
const { makeSharedDir } = require('../utils/runner')

const config = require('../config')

// Matches nextflow jobs from both backends: 'nextflow' is the direct queue,
// 'runner' with the nextflow runner name is the job-runner queue. Matching both
// means a mode change does not orphan in-flight jobs.
// Built lazily so the query reflects configuration at call time.
const nextflowJobQuery = () => ({
  $or: [
    { queue: 'nextflow' },
    { queue: 'runner', runner: config.NEXTFLOW.RUNNER_NAME },
  ],
  status: { $in: ['Submitted', 'Running'] },
})

/**
 * Requeues projects that were claimed for submission but never got a job.
 * See the equivalent in crons/localMonitors.js.
 *
 * @return {Promise<void>}
 */
const recoverStaleSubmissions = async () => {
  const staleBefore = new Date(Date.now() - config.RUNNER.SUBMISSION_STALE_MS)
  const projects = await Project.find({
    type: { $in: nextflowWorkflows },
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

const nextflowWorkflowMonitor = async () => {
  logger.debug('Nextflow workflow monitor')
  try {
    await recoverStaleSubmissions()
    // only process one job at each time based on job updated time
    const jobs = await Job.find(nextflowJobQuery()).sort({ updated: 1 })
    // submit request only when the current nextflow running jobs less than the max allowed jobs
    if (jobs.length >= config.NEXTFLOW.NUM_JOBS_MAX) {
      return
    }
    // get current running/submitted projects' input size
    let jobInputsize = 0
    jobs.forEach(job => {
      jobInputsize += job.inputSize || 0
    })
    // only process one request at each time
    const projs = await Project.find({
      type: { $in: nextflowWorkflows },
      status: 'in queue',
    }).sort({ updated: 1 })
    const proj = projs[0]
    if (!proj) {
      logger.debug('No nextflow workflow request to process')
      return
    }
    // parse conf.json
    const projHome = `${config.IO.PROJECT_BASE_DIR}/${proj.code}`
    const projectConf = JSON.parse(fs.readFileSync(`${projHome}/conf.json`))

    // check input size
    const inputsize = await common.findInputsize(projectConf)
    if (inputsize > config.NEXTFLOW.JOBS_INPUT_MAX_SIZE_BYTES) {
      logger.debug(`Project ${proj.code} input size exceeded the limit.`)
      // fail project
      proj.status = 'failed'
      await proj.save()
      common.write2log(
        `${config.IO.PROJECT_BASE_DIR}/${proj.code}/log.txt`,
        'input size exceeded the limit.',
      )
      return
    }
    if (jobInputsize + inputsize > config.NEXTFLOW.JOBS_INPUT_MAX_SIZE_BYTES) {
      logger.debug('Nextflow is busy.')
      return
    }

    logger.info(`Processing workflow request: ${proj.code}`)
    // set project status to 'processing'
    proj.status = 'processing'
    await proj.save()
    // process request
    // create output directory, in case nextflow needs permission to write to it
    makeSharedDir(
      `${projHome}/${workflowList[projectConf.workflow.name].outdir}`,
    )
    // Generate nextflow.config
    common.write2log(
      `${config.IO.PROJECT_BASE_DIR}/${proj.code}/log.txt`,
      'Generate nextflow.config',
    )
    logger.info('Generate nextflow.config')
    try {
      await generateInputs(projHome, projectConf, proj)
      // submit workflow to nextflow
      const now = new Date()
      common.write2log(
        `${config.IO.PROJECT_BASE_DIR}/${proj.code}/log.txt`,
        `[${now.toLocaleString()}] Submit workflow to nextflow`,
      )
      logger.info('Submit workflow to nextflow')
      await submitWorkflow(proj, projectConf, inputsize)
      logger.info('Done workflow submission')
    } catch (err) {
      // fail project
      proj.status = 'failed'
      await proj.save()
      throw err
    }
  } catch (err) {
    logger.error(`nextflowWorkflowMonitor failed:${err}`)
  }
}

const nextflowJobMonitor = async () => {
  logger.debug('nextflow job monitor')
  try {
    // only process one job at each time based on job updated time
    const job = await Job.findOne(nextflowJobQuery()).sort({ updated: 1 })
    if (!job) {
      logger.debug('No nextflow job to process')
      return
    }
    logger.debug(`nextflow ${job.id}`)
    // find related project
    const proj = await Project.findOne({ code: job.project })
    if (!proj) {
      // Cancel the execution before discarding the only handle to it.
      await abortJob({ code: job.project }, job)
      await Job.deleteOne({ project: job.project })
    } else if (proj.status === 'delete') {
      await abortJob(proj, job)
    } else {
      await updateJobStatus(job, proj)
    }
  } catch (err) {
    logger.error(`nextflowJobMonitor failed:${err}`)
  }
}

module.exports = {
  nextflowWorkflowMonitor,
  nextflowJobMonitor,
}
