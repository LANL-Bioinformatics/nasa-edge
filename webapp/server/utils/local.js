const fs = require('fs')
const dayjs = require('dayjs')
const duration = require('dayjs/plugin/duration')
// Activate the plugin
dayjs.extend(duration)
const Job = require('../edge-api/models/job')
const { generateWorkflowResult, checkFlagFile } = require('../workflow/util')
const { timeFormat, execCmd, pidIsRunning } = require('./common')
const logger = require('./logger')
const config = require('../config')

const generateRunStats = async project => {
  const timeStats = ['complete', 'failed', 'aborted']
  const job = await Job.findOne({ project: project.code })
  let startTime = dayjs(job.created, 'YYYY-MM-DD HH:mm:ss')
  let endTime = timeStats.includes(project.status)
    ? dayjs(job.updated, 'YYYY-MM-DD HH:mm:ss')
    : dayjs(Date.now())
  // get time from run_time.txt if exists, which is more accurate for local workflow
  // Thu May 28 09:07:15 AM MDT 2026
  // Thu May 28 09:08:09 AM MDT 2026
  const runTimeFile = `${config.IO.PROJECT_BASE_DIR}/${project.code}/run_time.txt`
  if (fs.existsSync(runTimeFile)) {
    const runTimeContent = String(fs.readFileSync(runTimeFile)).split('\n')
    if (
      runTimeContent[0] &&
      dayjs(runTimeContent[0], 'ddd MMM DD HH:mm:ss A Z YYYY').isValid()
    ) {
      startTime = dayjs(runTimeContent[0], 'ddd MMM DD HH:mm:ss A Z YYYY')
    }
    if (
      runTimeContent[1] &&
      dayjs(runTimeContent[1], 'ddd MMM DD HH:mm:ss A Z YYYY').isValid()
    ) {
      endTime = dayjs(runTimeContent[1], 'ddd MMM DD HH:mm:ss A Z YYYY')
    }
  }

  const ms = endTime.diff(startTime)
  const d = dayjs.duration(ms)
  const stats = []
  stats.push({
    Workflow: job.type,
    Status: job.status,
    'Running Time': timeFormat(d),
    Start: startTime.format('YYYY-MM-DD HH:mm:ss'),
    End: timeStats.includes(project.status)
      ? endTime.format('YYYY-MM-DD HH:mm:ss')
      : '',
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
    job.updated = Date.now()
    job.save()
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
