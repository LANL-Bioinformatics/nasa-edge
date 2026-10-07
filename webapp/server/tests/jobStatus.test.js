/* eslint-env jest */
const {
  getNextflowTaskStatus,
  getProjectStatus,
  getRunnerJobStatus,
  isNotFound,
  isPermanentRunnerError,
  runnerErrorMessage,
} = require('../utils/jobStatus')

const httpError = status => ({ response: { status }, message: 'http error' })

describe('runner status mapping', () => {
  test('maps every documented runner status', () => {
    expect(getRunnerJobStatus('queued')).toBe('Submitted')
    expect(getRunnerJobStatus('running')).toBe('Running')
    expect(getRunnerJobStatus('succeeded')).toBe('Succeeded')
    expect(getRunnerJobStatus('failed')).toBe('Failed')
    expect(getRunnerJobStatus('cancelled')).toBe('Aborted')
  })

  test('returns undefined for an unknown status so callers can fail loudly', () => {
    expect(getRunnerJobStatus('paused')).toBeUndefined()
  })

  test('maps job status onto project status', () => {
    expect(getProjectStatus('Submitted')).toBe('submitted')
    expect(getProjectStatus('Running')).toBe('running')
    expect(getProjectStatus('Succeeded')).toBe('complete')
    expect(getProjectStatus('Failed')).toBe('failed')
    expect(getProjectStatus('Aborted')).toBe('failed')
  })
})

describe('nextflow trace interpretation', () => {
  test('succeeds only when every task completed', () => {
    expect(
      getNextflowTaskStatus([
        { name: 'a', status: 'COMPLETED' },
        { name: 'b', status: 'COMPLETED' },
      ]),
    ).toBe('Succeeded')
  })

  test('uses the last status for a retried task', () => {
    expect(
      getNextflowTaskStatus([
        { name: 'a', status: 'FAILED' },
        { name: 'a', status: 'COMPLETED' },
      ]),
    ).toBe('Succeeded')
  })

  test('fails when any task did not complete', () => {
    expect(
      getNextflowTaskStatus([
        { name: 'a', status: 'COMPLETED' },
        { name: 'b', status: 'FAILED' },
      ]),
    ).toBe('Failed')
  })

  test('reports aborted when any task was aborted', () => {
    expect(
      getNextflowTaskStatus([
        { name: 'a', status: 'COMPLETED' },
        { name: 'b', status: 'ABORTED' },
      ]),
    ).toBe('Aborted')
  })

  test('treats an empty trace as a failure, not a success', () => {
    expect(getNextflowTaskStatus([])).toBe('Failed')
  })
})

describe('runner error classification', () => {
  test('4xx is permanent because a replay cannot change the outcome', () => {
    expect(isPermanentRunnerError(httpError(400))).toBe(true)
    expect(isPermanentRunnerError(httpError(401))).toBe(true)
    expect(isPermanentRunnerError(httpError(404))).toBe(true)
    expect(isPermanentRunnerError(httpError(422))).toBe(true)
  })

  test('408 and 429 are transient because they invite a retry', () => {
    expect(isPermanentRunnerError(httpError(408))).toBe(false)
    expect(isPermanentRunnerError(httpError(429))).toBe(false)
  })

  test('5xx and network failures are transient', () => {
    expect(isPermanentRunnerError(httpError(500))).toBe(false)
    expect(isPermanentRunnerError(httpError(503))).toBe(false)
    expect(isPermanentRunnerError({ message: 'ECONNREFUSED' })).toBe(false)
  })

  test('submission-building failures are permanent', () => {
    const error = new Error('Unknown workflow')
    error.runnerPermanent = true
    expect(isPermanentRunnerError(error)).toBe(true)
  })

  test('identifies a missing job', () => {
    expect(isNotFound(httpError(404))).toBe(true)
    expect(isNotFound(httpError(500))).toBe(false)
    expect(isNotFound(new Error('boom'))).toBe(false)
  })

  test('prefers the runner error text over the axios message', () => {
    expect(
      runnerErrorMessage({
        response: { data: { error: 'workflowPath does not exist' } },
        message: 'Request failed with status code 400',
      }),
    ).toBe('workflowPath does not exist')
  })

  test('falls back to the error message', () => {
    expect(runnerErrorMessage(new Error('socket hang up'))).toBe(
      'socket hang up',
    )
  })
})
