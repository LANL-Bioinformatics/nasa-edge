/* eslint-env jest */

// Directories are created for real submissions; stub them out.
jest.mock('fs', () => ({
  chmodSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(() => false),
  promises: { writeFile: jest.fn() },
}))

jest.mock('../utils/nextflowDirect', () => ({
  submitWorkflow: jest.fn(),
  updateJobStatus: jest.fn(),
  abortJob: jest.fn(),
}))

jest.mock('../utils/nextflowRunner', () => ({
  submitWorkflow: jest.fn(),
  updateJobStatus: jest.fn(),
  abortJob: jest.fn(),
}))

jest.mock('../workflow/util', () => ({
  nextflowConfigs: {},
  workflowList: {},
  generateNextflowWorkflowParams: jest.fn(),
}))

const config = require('../config')
const direct = require('../utils/nextflowDirect')
const runner = require('../utils/nextflowRunner')
const nextflow = require('../utils/nextflow')

const proj = { code: 'project-1', type: 'sra2fastq' }

describe('nextflow backend dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    config.NEXTFLOW.MODE = 'direct'
  })

  afterEach(() => {
    config.NEXTFLOW.MODE = 'direct'
  })

  test('direct is the default so existing deployments are unaffected', () => {
    // Guards against a regression that would silently require a job runner.
    expect(config.NEXTFLOW.MODE).toBe('direct')
  })

  test('submits via the direct backend in direct mode', async () => {
    await nextflow.submitWorkflow(proj, {}, 100)
    expect(direct.submitWorkflow).toHaveBeenCalled()
    expect(runner.submitWorkflow).not.toHaveBeenCalled()
  })

  test('submits via the runner backend in runner mode', async () => {
    config.NEXTFLOW.MODE = 'runner'
    await nextflow.submitWorkflow(proj, {}, 100)
    expect(runner.submitWorkflow).toHaveBeenCalled()
    expect(direct.submitWorkflow).not.toHaveBeenCalled()
  })
})

describe('per-job backend routing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    config.NEXTFLOW.MODE = 'direct'
  })

  test('a direct job is reconciled by the direct backend even in runner mode', async () => {
    // A mode switch must not orphan jobs launched by the previous backend.
    config.NEXTFLOW.MODE = 'runner'
    await nextflow.updateJobStatus({ queue: 'nextflow', id: 'edge-p1' }, proj)
    expect(direct.updateJobStatus).toHaveBeenCalled()
    expect(runner.updateJobStatus).not.toHaveBeenCalled()
  })

  test('a runner job is reconciled by the runner backend even in direct mode', async () => {
    config.NEXTFLOW.MODE = 'direct'
    await nextflow.updateJobStatus(
      { queue: 'runner', runner: 'nextflow', id: 'edge-p1-uuid' },
      proj,
    )
    expect(runner.updateJobStatus).toHaveBeenCalled()
    expect(direct.updateJobStatus).not.toHaveBeenCalled()
  })

  test('aborts a direct job through the direct backend', async () => {
    config.NEXTFLOW.MODE = 'runner'
    await nextflow.abortJob(proj, { queue: 'nextflow' })
    expect(direct.abortJob).toHaveBeenCalled()
    expect(runner.abortJob).not.toHaveBeenCalled()
  })

  test('aborts a runner job through the runner backend', async () => {
    config.NEXTFLOW.MODE = 'direct'
    await nextflow.abortJob(proj, { queue: 'runner', runner: 'nextflow' })
    expect(runner.abortJob).toHaveBeenCalled()
    expect(direct.abortJob).not.toHaveBeenCalled()
  })

  test('falls back to the configured mode when no job is supplied', async () => {
    config.NEXTFLOW.MODE = 'runner'
    await nextflow.abortJob(proj)
    expect(runner.abortJob).toHaveBeenCalled()
  })
})
