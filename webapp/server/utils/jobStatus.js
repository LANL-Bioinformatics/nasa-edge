/**
 * Translation between job-runner vocabulary and EDGE's own job/project status
 * vocabulary, plus the retry policy for job-runner HTTP failures.
 *
 * Keeping this in one place means the nextflow path and the local/tool path
 * cannot drift apart on what "failed" means or on which errors are worth
 * retrying.
 */

// Job runner status -> Job.status (see edge-api/utils/conf.js jobStatus)
const RUNNER_TO_JOB_STATUS = {
  queued: 'Submitted',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  cancelled: 'Aborted',
}

// Job.status -> Project.status (see edge-api/utils/conf.js projectStatus)
const JOB_TO_PROJECT_STATUS = {
  Submitted: 'submitted',
  Running: 'running',
  Succeeded: 'complete',
  Failed: 'failed',
  Aborted: 'failed',
}

/**
 * Maps a job-runner status onto a Job.status.
 *
 * Returns `undefined` for an unrecognized status so callers can fail loudly
 * rather than silently treating a new runner state as a terminal one.
 *
 * @param status {string} The status reported by the job runner
 * @return {string|undefined} The corresponding Job.status
 */
const getRunnerJobStatus = status => RUNNER_TO_JOB_STATUS[status]

/**
 * Maps a Job.status onto the Project.status it implies.
 *
 * @param status {string} A Job.status value
 * @return {string|undefined} The corresponding Project.status
 */
const getProjectStatus = status => JOB_TO_PROJECT_STATUS[status]

/**
 * Derives an overall status from a Nextflow trace file.
 *
 * A run can exit 0 while individual tasks failed, so a successful runner exit
 * is not sufficient evidence that the workflow succeeded. Retried tasks appear
 * more than once in the trace; the last entry for a task name wins.
 *
 * @param jobMetadata {object[]} Parsed rows of nextflow/trace.txt
 * @return {string} 'Succeeded', 'Failed', or 'Aborted'
 */
const getNextflowTaskStatus = jobMetadata => {
  const latestStatuses = {}
  jobMetadata.forEach(task => {
    if (task.name && task.status) latestStatuses[task.name] = task.status
  })
  const statuses = Object.values(latestStatuses)
  // An empty trace means no task ever ran, which is not a success.
  if (statuses.length === 0) return 'Failed'
  if (statuses.includes('ABORTED')) return 'Aborted'
  if (statuses.some(status => status !== 'COMPLETED')) return 'Failed'
  return 'Succeeded'
}

/**
 * Extracts the HTTP status code from an axios error, if any.
 *
 * @param error {Error} The rejected error
 * @return {number|undefined} The HTTP status code
 */
const getHttpStatus = error =>
  error.response ? error.response.status : undefined

/**
 * Returns `true` when the job runner reported that it has no such job.
 *
 * @param error {Error} The rejected error
 * @return {boolean}
 */
const isNotFound = error => getHttpStatus(error) === 404

/**
 * Returns `true` when an error cannot succeed on retry.
 *
 * A 4xx means the request itself is wrong (bad path, unknown workflow, bad
 * credentials) and will fail identically forever, so the job should be failed
 * now. 408/429 are excluded because they explicitly invite a retry. Timeouts,
 * 5xx, and network errors are transient: the job stays 'Submitted' and the
 * monitor retries with the same idempotency key.
 *
 * Errors raised while *building* a submission are also permanent; those set
 * `runnerPermanent` directly since they never reach the network.
 *
 * @param error {Error} The rejected error
 * @return {boolean}
 */
const isPermanentRunnerError = error => {
  if (error.runnerPermanent === true) return true
  const status = getHttpStatus(error)
  if (status === undefined) return false
  return status >= 400 && status < 500 && ![408, 429].includes(status)
}

/**
 * Produces a human-readable message for a job-runner failure, preferring the
 * runner's own error text over axios' generic message.
 *
 * @param error {Error} The rejected error
 * @return {string}
 */
const runnerErrorMessage = error => {
  if (error.response && error.response.data) {
    const { data } = error.response
    if (data.error) return data.error
    if (typeof data === 'string') return data
    return JSON.stringify(data)
  }
  return error.message || String(error)
}

module.exports = {
  getHttpStatus,
  getNextflowTaskStatus,
  getProjectStatus,
  getRunnerJobStatus,
  isNotFound,
  isPermanentRunnerError,
  runnerErrorMessage,
}
