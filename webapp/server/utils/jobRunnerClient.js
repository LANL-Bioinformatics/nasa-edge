const fs = require('fs')
const axios = require('axios')
const config = require('../config')

/**
 * Resolves a secret from either a literal value or a file containing it.
 *
 * The file form is preferred in container deployments (Docker/Kubernetes
 * secrets) because the value never appears in the process environment.
 *
 * @param value {string|undefined} A literal secret
 * @param file {string|undefined} Path to a file holding the secret
 * @return {string} The secret, or an empty string when neither is set
 */
const readSecret = (value, file) => {
  if (value && value.trim()) {
    return value.trim()
  }
  if (file && file.trim()) {
    return fs.readFileSync(file.trim(), 'utf8').trim()
  }
  return ''
}

/**
 * Thin HTTP client for a single job-runner service.
 *
 * The job runner exposes a small durable job API:
 *   POST   <base>/jobs           submit (idempotent)
 *   GET    <base>/jobs/<jobId>   poll
 *   DELETE <base>/jobs/<jobId>   cancel
 *
 * Submissions carry an `Idempotency-Key` equal to the job id, so a request that
 * is interrupted after the runner accepted it can be safely replayed: the
 * runner returns the existing job instead of starting a second execution. This
 * is what allows callers to persist the job handle *before* submitting.
 *
 * `httpClient` is injectable purely so the request contract can be unit tested
 * without a live runner.
 */
class JobRunnerClient {
  constructor({ baseUrl, token, tokenFile, timeoutMs, httpClient = axios }) {
    if (!baseUrl) {
      throw new Error('JobRunnerClient requires a baseUrl')
    }
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.token = readSecret(token, tokenFile)
    this.timeoutMs = timeoutMs
    this.httpClient = httpClient
  }

  /**
   * Builds request headers, adding bearer auth only when a token is configured
   * so that unauthenticated runners are not sent an empty Authorization header.
   *
   * @param extra {object} Additional headers to merge in
   * @return {object} The headers
   */
  headers(extra = {}) {
    const headers = { ...extra }
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }
    return headers
  }

  /**
   * Returns the axios request options shared by every call.
   *
   * @param extraHeaders {object} Additional headers to merge in
   * @return {object} The axios request config
   */
  requestConfig(extraHeaders = {}) {
    return { headers: this.headers(extraHeaders), timeout: this.timeoutMs }
  }

  /**
   * Submits a job. Safe to call repeatedly for the same `jobId`.
   *
   * @param job {{jobId: string, projectId: string, input: object}} The submission
   * @return {Promise<object>} The runner's job representation
   */
  async submit(job) {
    const response = await this.httpClient.post(
      `${this.baseUrl}/jobs`,
      job,
      this.requestConfig({ 'Idempotency-Key': job.jobId }),
    )
    return response.data
  }

  /**
   * Fetches the current state of a job.
   *
   * @param jobId {string} The job handle
   * @return {Promise<object>} The runner's job representation
   */
  async get(jobId) {
    const response = await this.httpClient.get(
      `${this.baseUrl}/jobs/${encodeURIComponent(jobId)}`,
      this.requestConfig(),
    )
    return response.data
  }

  /**
   * Requests cancellation of a job.
   *
   * @param jobId {string} The job handle
   * @return {Promise<object>} The runner's job representation
   */
  async cancel(jobId) {
    const response = await this.httpClient.delete(
      `${this.baseUrl}/jobs/${encodeURIComponent(jobId)}`,
      this.requestConfig(),
    )
    return response.data
  }
}

// One client per runner, created on first use. Clients are stateless apart from
// their configuration, so they are safe to share across monitor invocations.
const clients = {}

/**
 * Returns the client for a named runner, creating it if necessary.
 *
 * Throws with `runnerPermanent` set when the runner is not registered in
 * `config.RUNNER.SERVICES`: a misconfigured runner name will never resolve, so
 * the affected job should fail immediately rather than be retried forever.
 *
 * @param runner {string} The runner name, e.g. 'nextflow'
 * @return {JobRunnerClient} The client
 */
const getRunnerClient = runner => {
  if (clients[runner]) return clients[runner]
  const service = config.RUNNER.SERVICES[runner]
  if (!service || !service.BASE_URL) {
    const error = new Error(
      `No job runner configured for '${runner}'. Set ${runner.toUpperCase()}_RUNNER_URL or RUNNER_SERVICES.`,
    )
    error.runnerPermanent = true
    throw error
  }
  clients[runner] = new JobRunnerClient({
    baseUrl: service.BASE_URL,
    token: service.API_TOKEN || config.RUNNER.API_TOKEN,
    tokenFile: service.API_TOKEN_FILE,
    timeoutMs: config.RUNNER.REQUEST_TIMEOUT_MS,
  })
  return clients[runner]
}

/**
 * Clears the memoized clients. Intended for tests that reconfigure runners.
 */
const resetRunnerClients = () => {
  Object.keys(clients).forEach(key => {
    delete clients[key]
  })
}

module.exports = {
  JobRunnerClient,
  getRunnerClient,
  readSecret,
  resetRunnerClients,
}
