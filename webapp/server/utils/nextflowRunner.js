/**
 * Runner-backed nextflow execution: the workflow is submitted to a job-runner
 * HTTP service, selected by NEXTFLOW_MODE=runner.
 *
 * Compared to direct execution this gives durable job handles, idempotent
 * submission, and lets the web server run without the nextflow CLI installed.
 */

const Job = require('../edge-api/models/job')
const { write2log } = require('./common')
const {
  getNextflowTaskStatus,
  getProjectStatus,
  getRunnerJobStatus,
  isNotFound,
  isPermanentRunnerError,
  runnerErrorMessage,
} = require('./jobStatus')
const {
  cancelRunnerJob,
  generateJobId,
  getRunnerJob,
  submitRunnerJob,
} = require('./runner')
const {
  generateWorkflowResult,
  zipProjectOutputs,
} = require('../workflow/util')
const logger = require('./logger')
const config = require('../config')

/**
 * Copies runner-reported details onto the job document.
 *
 * @param job {object} The job document
 * @param runnerJob {object} The runner's job representation
 */
const applyRunnerFields = (job, runnerJob) => {
  if (runnerJob.exitCode !== undefined) job.exitCode = runnerJob.exitCode
  if (runnerJob.error) job.error = runnerJob.error
  if (runnerJob.startedAt) job.startedAt = runnerJob.startedAt
  if (runnerJob.finishedAt) job.finishedAt = runnerJob.finishedAt
}

/**
 * Submits a nextflow workflow to the job runner.
 *
 * The job document is persisted *before* the HTTP call so a crash between "the
 * runner accepted the job" and "we recorded it" cannot orphan an execution. The
 * monitor reconciles such a job by re-submitting under the same idempotency
 * key, which the runner treats as a lookup rather than a new run.
 *
 * @param proj {object} The project document
 * @param projectConf {object} The parsed project conf.json (unused here; the
 *   submission is rebuilt from disk so a retry sees the same inputs)
 * @param inputsize {number} Total input size in bytes
 * @return {Promise<void>}
 */
// eslint-disable-next-line no-unused-vars
const submitWorkflow = async (proj, projectConf, inputsize) => {
  const projHome = `${config.IO.PROJECT_BASE_DIR}/${proj.code}`
  const jobId = generateJobId(proj)
  const newJob = new Job({
    id: jobId,
    project: proj.code,
    type: proj.type,
    inputSize: inputsize,
    queue: 'runner',
    runner: config.NEXTFLOW.RUNNER_NAME,
    status: 'Submitted',
  })
  await newJob.save()
  proj.status = 'submitted'
  await proj.save()

  try {
    const runnerJob = await submitRunnerJob(proj, jobId)
    const status = getRunnerJobStatus(runnerJob.status)
    if (!status) {
      throw new Error(`Unknown nextflow runner status '${runnerJob.status}'`)
    }
    newJob.status = status
    applyRunnerFields(newJob, runnerJob)
    proj.status = getProjectStatus(status) || proj.status
  } catch (error) {
    const message = runnerErrorMessage(error)
    newJob.error = message
    if (isPermanentRunnerError(error)) {
      newJob.status = 'Failed'
      proj.status = 'failed'
      write2log(`${projHome}/log.txt`, `Nextflow submission failed: ${message}`)
    } else {
      // Transient: leave the job Submitted so the monitor retries it.
      write2log(
        `${projHome}/log.txt`,
        `Nextflow submission pending: ${message}`,
      )
    }
    logger.error(
      `Nextflow runner submission failed for ${proj.code}: ${message}`,
    )
  }
  await Promise.all([newJob.save(), proj.save()])
}

/**
 * Reconciles a nextflow job against the job runner.
 *
 * @param job {object} The job document
 * @param proj {object} The project document
 * @param getJobMetadata {function} Reads the nextflow trace rows for a project
 * @return {Promise<void>}
 */
const updateJobStatus = async (job, proj, getJobMetadata) => {
  const projHome = `${config.IO.PROJECT_BASE_DIR}/${proj.code}`
  let runnerJob
  try {
    runnerJob = await getRunnerJob(job)
  } catch (error) {
    if (!isNotFound(error)) throw error
    // The runner has no record of a job we believe we submitted.
    if (job.status !== 'Submitted') {
      job.status = 'Failed'
      job.error = 'Job runner has no record of this job'
      proj.status = 'failed'
      write2log(
        `${projHome}/log.txt`,
        'Nextflow job status: failed (lost by runner)',
      )
      await Promise.all([job.save(), proj.save()])
      return
    }
    // Never confirmed: replay under the same idempotency key.
    try {
      runnerJob = await submitRunnerJob(proj, job.id)
    } catch (submissionError) {
      if (!isPermanentRunnerError(submissionError)) throw submissionError
      const message = runnerErrorMessage(submissionError)
      job.status = 'Failed'
      job.error = message
      proj.status = 'failed'
      write2log(`${projHome}/log.txt`, `Nextflow submission failed: ${message}`)
      await Promise.all([job.save(), proj.save()])
      return
    }
  }

  let newStatus = getRunnerJobStatus(runnerJob.status)
  if (!newStatus) {
    throw new Error(`Unknown nextflow runner status '${runnerJob.status}'`)
  }
  applyRunnerFields(job, runnerJob)
  // A zero exit code does not prove every task succeeded, so confirm against
  // the trace before reporting success.
  if (newStatus === 'Succeeded') {
    newStatus = getNextflowTaskStatus(await getJobMetadata(proj))
  }

  const statusChanged = job.status !== newStatus
  if (newStatus === 'Succeeded') {
    logger.info('generate workflow result.json')
    try {
      generateWorkflowResult(proj)
      await zipProjectOutputs(proj)
      proj.status = 'complete'
    } catch (error) {
      // Output did not match expectations: a failed run, not a successful one.
      newStatus = 'Failed'
      job.error = `Result generation failed: ${error.message}`
      proj.status = 'failed'
      write2log(`${projHome}/log.txt`, `Result generation failed: ${error}`)
    }
  } else {
    proj.status = getProjectStatus(newStatus)
  }
  job.status = newStatus
  // Always touch the job so it moves to the end of the monitor queue.
  job.updated = Date.now()

  if (statusChanged) {
    const detail = job.error ? `: ${job.error}` : ''
    write2log(
      `${projHome}/log.txt`,
      `Nextflow job status: ${newStatus}${detail}`,
    )
  }
  await Promise.all([job.save(), proj.save()])
}

/**
 * Cancels a nextflow job at the runner.
 *
 * @param proj {object} The project document, or `{ code }` for an orphaned job
 * @param existingJob {object} [existingJob] The job, looked up when omitted
 * @return {Promise<void>}
 */
const abortJob = async (proj, existingJob) => {
  const job = existingJob || (await Job.findOne({ project: proj.code }))
  if (!job) return
  try {
    const runnerJob = await cancelRunnerJob(job)
    job.status = getRunnerJobStatus(runnerJob.status) || 'Aborted'
    applyRunnerFields(job, runnerJob)
  } catch (error) {
    // Already gone: nothing to cancel, so treat it as aborted.
    if (!isNotFound(error)) {
      logger.error(
        `Abort nextflow job ${job.id} failed: ${runnerErrorMessage(error)}`,
      )
      throw error
    }
    job.status = 'Aborted'
  }
  await job.save()
  write2log(
    `${config.IO.PROJECT_BASE_DIR}/${job.project}/log.txt`,
    'Nextflow job aborted.',
  )
}

module.exports = {
  abortJob,
  submitWorkflow,
  updateJobStatus,
}
