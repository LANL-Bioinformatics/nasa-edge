const fs = require('fs')
const moment = require('moment')
const Job = require('../edge-api/models/job')
const { generateWorkflowResult, checkFlagFile } = require('../workflow/util')
const { timeFormat, execCmd, pidIsRunning } = require('./common')
const logger = require('./logger')
const config = require('../config')

const generateRunStats = async project => {
  const job = await Job.findOne({ project: project.code })
  const ms = moment(job.updated, 'YYYY-MM-DD HH:mm:ss').diff(
    moment(job.created, 'YYYY-MM-DD HH:mm:ss'),
  )
  const d = moment.duration(ms)
  const stats = []
  stats.push({
    Workflow: job.type,
    Status: job.status,
    'Running Time': timeFormat(d),
    Start: moment(job.created).format('YYYY-MM-DD HH:mm:ss'),
    End: moment(job.updated).format('YYYY-MM-DD HH:mm:ss'),
  })
  fs.writeFileSync(
    `${config.IO.PROJECT_BASE_DIR}/${project.code}/run_stats.json`,
    JSON.stringify({ stats }),
  )
}

const abortJob = job => {
  try {
    // abort job if it is running
    logger.debug(`Abort job by pid ${job.pid}`)
    // kill the process
    if (job.pid && pidIsRunning(job.pid)) {
      const cmd = `pkill -TERM -P ${job.pid}`
      // Don't need to wait for the deletion, the process may already complete
      execCmd(cmd)
    }
    // update job status
    job.status = 'Aborted'
    job.save()
    logger.info(
      `${config.IO.PROJECT_BASE_DIR}/${job.project}/log.txt`,
      'Local job aborted.',
    )
  } catch (err) {
    logger.error(`Abort local job ${job.id} failed: ${err}`)
  }
}

const updateJobStatus = (job, proj) => {
  // process request
  if (pidIsRunning(job.pid)) {
    // not finished yet, just update the timestamp to put it at the end of the queue
    job.save();
  } else {
    let status = 'complete'
    let jobStatus = 'Succeeded'
    if (checkFlagFile(proj, 'local') === false) {
      status = 'failed'
      jobStatus = 'Failed'
    } else {
      generateWorkflowResult(proj)
    }
    // update project status
    job.status = jobStatus
    job.save()
    proj.status = status
    proj.save()
  }
}

module.exports = {
  generateRunStats,
  abortJob,
  updateJobStatus,
}
