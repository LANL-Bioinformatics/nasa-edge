const fs = require('fs')
const Project = require('../edge-api/models/project')
const Job = require('../edge-api/models/job')
const { abortJob, updateJobStatus } = require('../utils/nextflow')
const common = require('../utils/common')
const logger = require('../utils/logger')
const { nextflowWorkflows, workflowList } = require('../workflow/util')
const { generateInputs, submitWorkflow } = require('../utils/nextflow')

const config = require('../config')

const nextflowWorkflowMonitor = async () => {
  logger.debug('Nextflow workflow monitor')
  try {
    // only process one job at each time based on job updated time
    const jobs = await Job.find({
      queue: 'nextflow',
      status: { $in: ['Submitted', 'Running'] },
    }).sort({ updated: 1 })
    // submit request only when the current nextflow running jobs less than the max allowed jobs
    if (jobs.length >= config.NEXTFLOW.NUM_JOBS_MAX) {
      return
    }
    // get current running/submitted projects' input size
    let jobInputsize = 0
    jobs.forEach(job => {
      jobInputsize += job.inputSize
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
      proj.save()
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
    // create output directory
    fs.mkdirSync(
      `${projHome}/${workflowList[projectConf.workflow.name].outdir}`,
      { recursive: true },
    )
    // in case nextflow needs permission to write to the output directory
    fs.chmodSync(
      `${projHome}/${workflowList[projectConf.workflow.name].outdir}`,
      '777',
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
      submitWorkflow(proj, projectConf, inputsize)
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
    const jobs = await Job.find({
      queue: 'nextflow',
      status: { $in: ['Submitted', 'Running'] },
    }).sort({ updated: 1 })
    const job = jobs[0]
    if (!job) {
      logger.debug('No nextflow job to process')
      return
    }
    logger.debug(`nextflow ${job.id}`)
    // find related project
    const proj = await Project.findOne({ code: job.project })
    if (proj) {
      if (proj.status === 'delete') {
        // abort job
        abortJob(proj, job)
      } else {
        await updateJobStatus(job, proj)
      }
    } else {
      // delete from database
      Job.deleteOne({ project: job.project }, err => {
        if (err) {
          logger.error(`Failed to delete job from DB ${job.project}:${err}`)
        }
      })
    }
  } catch (err) {
    logger.error(`nextflowJobMonitor failed:${err}`)
  }
}

module.exports = {
  nextflowWorkflowMonitor,
  nextflowJobMonitor,
}
