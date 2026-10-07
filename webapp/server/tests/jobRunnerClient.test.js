/* eslint-env jest */
const { JobRunnerClient, readSecret } = require('../utils/jobRunnerClient')

describe('JobRunnerClient', () => {
  const httpClient = {
    post: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('submits an idempotent authenticated job', async () => {
    const job = {
      jobId: 'edge-project-1-abc',
      projectId: 'project-1',
      input: { configPath: '/io/projects/project-1/nextflow.config' },
    }
    httpClient.post.mockResolvedValue({
      data: { jobId: job.jobId, status: 'queued' },
    })
    const client = new JobRunnerClient({
      baseUrl: 'http://runner:7001/v1/',
      token: 'secret-token',
      timeoutMs: 5000,
      httpClient,
    })

    await expect(client.submit(job)).resolves.toEqual({
      jobId: job.jobId,
      status: 'queued',
    })
    // The idempotency key is what makes a replayed submission safe.
    expect(httpClient.post).toHaveBeenCalledWith(
      'http://runner:7001/v1/jobs',
      job,
      {
        headers: {
          Authorization: 'Bearer secret-token',
          'Idempotency-Key': job.jobId,
        },
        timeout: 5000,
      },
    )
  })

  test('polls and cancels by encoded job handle', async () => {
    httpClient.get.mockResolvedValue({ data: { status: 'running' } })
    httpClient.delete.mockResolvedValue({ data: { status: 'cancelled' } })
    const client = new JobRunnerClient({
      baseUrl: 'http://runner:7001/v1',
      token: '',
      timeoutMs: 5000,
      httpClient,
    })

    await client.get('edge job/1')
    await client.cancel('edge job/1')

    expect(httpClient.get).toHaveBeenCalledWith(
      'http://runner:7001/v1/jobs/edge%20job%2F1',
      { headers: {}, timeout: 5000 },
    )
    expect(httpClient.delete).toHaveBeenCalledWith(
      'http://runner:7001/v1/jobs/edge%20job%2F1',
      { headers: {}, timeout: 5000 },
    )
  })

  test('omits the Authorization header when no token is configured', async () => {
    httpClient.get.mockResolvedValue({ data: {} })
    const client = new JobRunnerClient({
      baseUrl: 'http://runner:7001/v1',
      timeoutMs: 1000,
      httpClient,
    })
    await client.get('job-1')
    const [, options] = httpClient.get.mock.calls[0]
    expect(options.headers).not.toHaveProperty('Authorization')
  })

  test('rejects a missing base URL rather than building bad URLs', () => {
    expect(() => new JobRunnerClient({ baseUrl: '', httpClient })).toThrow(
      /requires a baseUrl/,
    )
  })

  test('readSecret prefers a literal value over a file', () => {
    expect(readSecret('  literal  ', '/nonexistent')).toBe('literal')
  })

  test('readSecret returns an empty string when nothing is configured', () => {
    expect(readSecret(undefined, undefined)).toBe('')
  })
})
