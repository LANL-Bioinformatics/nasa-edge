const fs = require('fs')
const dayjs = require('dayjs')
const duration = require('dayjs/plugin/duration')
// Activate the plugin
dayjs.extend(duration)
const Job = require('../edge-api/models/job')
const { generateWorkflowResult, checkFlagFile } = require('../workflow/util')
const { timeFormat, execCmd, pidIsRunning, write2log } = require('./common')
const {
  getProjectStatus,
  getRunnerJobStatus,
  isNotFound,
  isPermanentRunnerError,
  runnerErrorMessage,
} = require('./jobStatus')
const { cancelRunnerJob, getRunnerJob, submitRunnerJob } = require('./runner')
const logger = require('./logger')
const config = require('../config')

/**
 * Returns `true` for jobs tracked by PID rather than by a job runner.
 *
 * @param job {object} The job document
 * @return {boolean}
 */
const isPidJob = job => job.queue === 'local'

/**
 * Copies terminal details from a job-runner response onto the job document.
 *
 * @param job {object} The job document
 * @param runnerJob {object} The runner's job representation
 */
const applyRunnerFields = (job, runnerJob) => {
  job.status = getRunnerJobStatus(runnerJob.status) || job.status
  if (runnerJob.exitCode !== undefined) job.exitCode = runnerJob.exitCode
  if (runnerJob.error) job.error = runnerJob.error
  if (runnerJob.startedAt) job.startedAt = runnerJob.startedAt
  if (runnerJob.finishedAt) job.finishedAt = runnerJob.finishedAt
}

const generateRunStats = async project => {
  const timeStats = ['complete', 'failed', 'aborted']
  const job = await Job.findOne({ project: project.code })
  // Prefer the runner's own timestamps: they bound the execution exactly,
  // whereas created/updated also include queueing and polling delay.
  let startTime = job.startedAt ? dayjs(job.startedAt) : dayjs(job.created)
  let endTime = timeStats.includes(project.status)
    ? dayjs(job.finishedAt || job.updated)
    : dayjs(Date.now())
  // get time from run_time.txt if exists, which is more accurate for pid-mode
  // workflows that have no runner timestamps
  // Thu May 28 09:07:15 AM MDT 2026
  // Thu May 28 09:08:09 AM MDT 2026
  const runTimeFile = `${config.IO.PROJECT_BASE_DIR}/${project.code}/run_time.txt`
  if (!job.startedAt && fs.existsSync(runTimeFile)) {
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

  const elapsed = dayjs.duration(endTime.diff(startTime))
  const stats = [
    {
      Workflow: job.type,
      Status: job.status,
      'Running Time': timeFormat(elapsed),
      Start: startTime.format('YYYY-MM-DD HH:mm:ss'),
      End: timeStats.includes(project.status)
        ? endTime.format('YYYY-MM-DD HH:mm:ss')
        : '',
    },
  ]
  fs.writeFileSync(
    `${config.IO.PROJECT_BASE_DIR}/${project.code}/run_stats.json`,
    JSON.stringify({ stats }),
  )
}

/**
 * Terminates a job, by signal in pid mode or by the runner API otherwise.
 *
 * @param job {object} The job document
 * @return {Promise<void>}
 */
const abortJob = async job => {
  if (isPidJob(job)) {
    logger.debug(`Abort job by pid ${job.pid}`)
    if (job.pid && pidIsRunning(job.pid)) {
      try {
        await execCmd(`pkill -TERM -P ${job.pid}`)
      } catch (error) {
        // The process may have exited between the check and the signal.
        logger.error(`Failed to terminate process ${job.pid}: ${error}`)
      }
    }
    job.status = 'Aborted'
    await job.save()
    write2log(
      `${config.IO.PROJECT_BASE_DIR}/${job.project}/log.txt`,
      'Local job aborted.',
    )
    return
  }

  try {
    const runnerJob = await cancelRunnerJob(job)
    applyRunnerFields(job, runnerJob)
  } catch (error) {
    // Already gone: nothing to cancel, so treat it as aborted.
    if (!isNotFound(error)) {
      logger.error(
        `Abort runner job ${job.id} failed: ${runnerErrorMessage(error)}`,
      )
      throw error
    }
    job.status = 'Aborted'
  }
  await job.save()
  write2log(
    `${config.IO.PROJECT_BASE_DIR}/${job.project}/log.txt`,
    'Runner job aborted.',
  )
}

/**
 * Finalizes a job whose execution has ended, validating expected output.
 *
 * @param job {object} The job document
 * @param proj {object} The project document
 * @param queue {string} The queue name passed to checkFlagFile
 */
const finalizeSucceeded = (job, proj, queue) => {
  try {
    if (!checkFlagFile(proj, queue)) {
      throw new Error('Expected workflow output was not created')
    }
    generateWorkflowResult(proj)
    job.status = 'Succeeded'
    proj.status = 'complete'
  } catch (error) {
    job.status = 'Failed'
    job.error = error.message
    proj.status = 'failed'
  }
}

/**
 * Reconciles a job against its execution, by PID or via the runner API.
 *
 * @param job {object} The job document
 * @param proj {object} The project document
 * @return {Promise<void>}
 */
const updateJobStatus = async (job, proj) => {
  if (isPidJob(job)) {
    if (job.pid && pidIsRunning(job.pid)) {
      // not finished yet, just update the timestamp to put it at the end of the queue
      job.updated = Date.now()
      await job.save()
      return
    }
    finalizeSucceeded(job, proj, 'local')
    await Promise.all([job.save(), proj.save()])
    return
  }

  let runnerJob
  try {
    runnerJob = await getRunnerJob(job)
  } catch (error) {
    if (!isNotFound(error)) throw error
    // The runner has no record of a job we believe we submitted. Replay it if
    // the submission was never confirmed; otherwise state was lost.
    if (job.status !== 'Submitted') {
      job.status = 'Failed'
      job.error = 'Job runner has no record of this job'
      proj.status = 'failed'
      await Promise.all([job.save(), proj.save()])
      return
    }
    try {
      runnerJob = await submitRunnerJob(proj, job.id)
    } catch (submissionError) {
      if (!isPermanentRunnerError(submissionError)) throw submissionError
      job.status = 'Failed'
      job.error = runnerErrorMessage(submissionError)
      proj.status = 'failed'
      await Promise.all([job.save(), proj.save()])
      return
    }
  }

  applyRunnerFields(job, runnerJob)
  if (job.status === 'Succeeded') {
    finalizeSucceeded(job, proj, 'runner')
  } else if (job.status === 'Aborted' && proj.status === 'delete') {
    // A cancellation we requested ourselves; leave the deletion in progress.
  } else {
    proj.status = getProjectStatus(job.status)
  }
  // Always touch the job so it moves to the end of the monitor queue.
  job.updated = Date.now()

  if (job.error) {
    write2log(
      `${config.IO.PROJECT_BASE_DIR}/${job.project}/log.txt`,
      `Runner job: ${job.error}`,
    )
  }
  await Promise.all([job.save(), proj.save()])
}

module.exports = {
  generateRunStats,
  abortJob,
  updateJobStatus,
}
