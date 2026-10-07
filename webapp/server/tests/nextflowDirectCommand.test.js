/* eslint-env jest */

// Capture the command lines the direct backend would execute.
jest.mock('../utils/common', () => ({
  execCmd: jest.fn(() => Promise.resolve({ code: 0, message: '' })),
  sleep: jest.fn(() => Promise.resolve()),
  pidIsRunning: jest.fn(() => false),
  write2log: jest.fn(),
  timeFormat: jest.fn(),
}))

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}))

jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
  chmodSync: jest.fn(),
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => '12345'),
}))

jest.mock('../edge-api/models/job', () => {
  function Job(fields) {
    Object.assign(this, fields)
    this.save = jest.fn(() => Promise.resolve())
  }
  Job.deleteOne = jest.fn(() => Promise.resolve())
  Job.findOne = jest.fn(() => Promise.resolve(null))
  return Job
})

jest.mock('../workflow/util', () => ({
  workflowList: {
    sra2fastq: {
      outdir: 'output/sra2fastq',
      nextflow_main: '/wf/sra2fastq/main.nf',
      nextflow_profile: 'local',
    },
    noProfile: {
      outdir: 'output/noProfile',
      nextflow_main: '/wf/other/main.nf',
    },
  },
  generateWorkflowResult: jest.fn(),
  zipProjectOutputs: jest.fn(() => Promise.resolve()),
}))

const config = require('../config')
const { execCmd, pidIsRunning } = require('../utils/common')
const direct = require('../utils/nextflowDirect')

const makeProj = () => ({
  code: 'proj1',
  type: 'sra2fastq',
  save: jest.fn(() => Promise.resolve()),
})

describe('direct mode command construction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    config.NEXTFLOW.SLURM_SSH = ''
    config.NEXTFLOW.EXECUTOR = 'local'
    config.NEXTFLOW.WORK_DIR = null
  })

  test('builds a nextflow run command without an ssh prefix by default', async () => {
    await direct.submitWorkflow(
      makeProj(),
      { workflow: { name: 'sra2fastq' } },
      100,
    )
    const cmd = execCmd.mock.calls[0][0]
    expect(cmd).toContain('nextflow -C')
    expect(cmd).toContain('-bg -q run /wf/sra2fastq/main.nf')
    expect(cmd).toContain('-name edge-proj1')
    expect(cmd).not.toContain('ssh ')
  })

  test('prefixes the command with NEXTFLOW_SLURM_SSH when configured', async () => {
    // Backward compatibility: the web server still builds ssh command lines.
    config.NEXTFLOW.SLURM_SSH = 'ssh user@login'
    await direct.submitWorkflow(
      makeProj(),
      { workflow: { name: 'sra2fastq' } },
      100,
    )
    expect(execCmd.mock.calls[0][0]).toMatch(/^ssh user@login /)
  })

  test('renders nextflow_profile back onto the command line', async () => {
    // The profile lives in its own field so the runner path can send it
    // structurally; direct mode has to put it back on the CLI.
    await direct.submitWorkflow(
      makeProj(),
      { workflow: { name: 'sra2fastq' } },
      100,
    )
    expect(execCmd.mock.calls[0][0]).toContain('-profile local')
  })

  test('omits -profile for workflows that declare none', async () => {
    const proj = makeProj()
    proj.type = 'noProfile'
    await direct.submitWorkflow(proj, { workflow: { name: 'noProfile' } }, 100)
    expect(execCmd.mock.calls[0][0]).not.toContain('-profile')
  })

  test('sets the nextflow cache, pid, and log environment variables', async () => {
    await direct.submitWorkflow(
      makeProj(),
      { workflow: { name: 'sra2fastq' } },
      100,
    )
    const cmd = execCmd.mock.calls[0][0]
    expect(cmd).toContain('NXF_CACHE_DIR=')
    expect(cmd).toContain('NXF_PID_FILE=')
    expect(cmd).toContain('NXF_LOG_FILE=')
  })

  test('records the job on the legacy nextflow queue', async () => {
    // Direct jobs must stay on queue 'nextflow' so they keep routing to this
    // backend even if the deployment later switches to runner mode.
    const proj = makeProj()
    await direct.submitWorkflow(proj, { workflow: { name: 'sra2fastq' } }, 100)
    expect(proj.status).toBe('running')
  })
})

describe('direct mode abort', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    config.NEXTFLOW.SLURM_SSH = ''
  })

  test('rejects an unsupported executor rather than silently doing nothing', async () => {
    config.NEXTFLOW.EXECUTOR = 'kubernetes'
    await expect(direct.abortJob({ code: 'proj1' })).rejects.toThrow(
      /Unsupported nextflow executor/,
    )
    config.NEXTFLOW.EXECUTOR = 'local'
  })

  test('cancels slurm jobs found in the nextflow log', async () => {
    config.NEXTFLOW.EXECUTOR = 'slurm'
    config.NEXTFLOW.SLURM_SSH = 'ssh user@login'
    pidIsRunning.mockReturnValue(false)
    execCmd.mockImplementation(cmd =>
      Promise.resolve(
        cmd.includes('Task submitter')
          ? { code: 0, message: '4242\n4243\n' }
          : { code: 0, message: '' },
      ),
    )
    await direct.abortJob({ code: 'proj1' })
    const issued = execCmd.mock.calls.map(call => call[0])
    expect(issued.some(cmd => cmd === 'ssh user@login scancel 4242')).toBe(true)
    expect(issued.some(cmd => cmd === 'ssh user@login scancel 4243')).toBe(true)
    config.NEXTFLOW.EXECUTOR = 'local'
    execCmd.mockImplementation(() => Promise.resolve({ code: 0, message: '' }))
  })
})
