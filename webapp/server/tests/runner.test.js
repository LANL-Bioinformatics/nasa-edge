/* eslint-env jest */

jest.mock('fs', () => ({
  chmodSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}))

jest.mock('../config', () => ({
  IO: { PROJECT_BASE_DIR: '/io/projects' },
  NEXTFLOW: {
    WORK_DIR: null,
    EXECUTOR: 'local',
    MODE: 'runner',
    RUNNER_NAME: 'nextflow',
  },
  RUNNER: {
    API_TOKEN: '',
    REQUEST_TIMEOUT_MS: 10000,
    SERVICES: { nextflow: { BASE_URL: 'http://nextflow-runner:7001/v1' } },
  },
}))

jest.mock('../workflow/util', () => ({
  workflowList: {
    sra2fastq: {
      runner: 'nextflow',
      outdir: 'output/sra2fastq',
      nextflow_main: '/workflows/sra2fastq/nextflow/main.nf',
      nextflow_profile: 'local',
      config_tmpl: '/workflows/sra2fastq/workflow_config.tmpl',
    },
    // A nextflow workflow that declares no runner, as in a direct-mode
    // deployment. It must still be recognized as a nextflow workflow.
    directNextflow: {
      outdir: 'output/directNextflow',
      nextflow_main: '/workflows/direct/main.nf',
      nextflow_profile: 'local',
      config_tmpl: '/workflows/direct/workflow_config.tmpl',
    },
    profileOnly: {
      runner: 'nextflow',
      outdir: 'output/profileOnly',
      nextflow_main: '/workflows/qc/main.nf',
      nextflow_profile: 'test,local',
    },
    noEntrypoint: {
      runner: 'nextflow',
      outdir: 'output/noEntrypoint',
    },
    unmanaged: {
      outdir: 'output/unmanaged',
    },
    tool: {
      runner: 'sometool',
      outdir: 'output/tool',
    },
  },
  generateRunnerInput: jest.fn(() => ({ inputPath: '/io/public/reads.fastq' })),
}))

const fs = require('fs')
const config = require('../config')
const { generateRunnerInput } = require('../workflow/util')
const {
  buildSubmission,
  generateJobId,
  getRunnerName,
  hasRunner,
  isNextflowRunner,
  isNextflowWorkflow,
} = require('../utils/runner')

const mockConf = name => {
  fs.readFileSync.mockReturnValue(
    JSON.stringify({ workflow: { name, input: {} } }),
  )
}

describe('runner resolution', () => {
  test('resolves the runner declared on the workflow', () => {
    expect(getRunnerName('sra2fastq')).toBe('nextflow')
    expect(getRunnerName('tool')).toBe('sometool')
  })

  test('a workflow with no runner is a permanent error', () => {
    expect.assertions(2)
    try {
      getRunnerName('unmanaged')
    } catch (error) {
      expect(error.runnerPermanent).toBe(true)
      expect(error.message).toMatch(/No job runner configured/)
    }
  })

  test('reports whether a workflow is runner-backed', () => {
    expect(hasRunner('tool')).toBe(true)
    expect(hasRunner('unmanaged')).toBe(false)
    expect(hasRunner('nonexistent')).toBe(false)
  })

  test('identifies nextflow workflows by entrypoint, not by runner field', () => {
    // A fork may revert nextflow to direct mode and drop the runner field.
    // Classification must not depend on it, otherwise the workflow disappears
    // from nextflowWorkflows and its monitor silently stalls.
    expect(isNextflowWorkflow('sra2fastq')).toBe(true)
    expect(isNextflowWorkflow('directNextflow')).toBe(true)
    expect(isNextflowWorkflow('tool')).toBe(false)
    expect(isNextflowWorkflow('unmanaged')).toBe(false)
    expect(isNextflowWorkflow('nonexistent')).toBe(false)
  })

  test('resolves a nextflow runner even when the workflow declares none', () => {
    expect(getRunnerName('directNextflow')).toBe('nextflow')
  })

  test('nextflow workflows are runner-backed only in runner mode', () => {
    // In direct mode the web server executes them itself, so they must not be
    // reported as runner-backed.
    config.NEXTFLOW.MODE = 'direct'
    try {
      expect(hasRunner('sra2fastq')).toBe(false)
      expect(hasRunner('directNextflow')).toBe(false)
      // Non-nextflow tools are unaffected by NEXTFLOW_MODE.
      expect(hasRunner('tool')).toBe(true)
    } finally {
      config.NEXTFLOW.MODE = 'runner'
    }
    expect(hasRunner('sra2fastq')).toBe(true)
  })

  test('maps the generic nextflow runner onto the configured service name', () => {
    // edge-v3 registers its service as 'edgev3_nextflow'; workflows still just
    // declare runner:'nextflow'.
    config.NEXTFLOW.RUNNER_NAME = 'edgev3_nextflow'
    try {
      expect(getRunnerName('sra2fastq')).toBe('edgev3_nextflow')
      // Non-nextflow runners are unaffected.
      expect(getRunnerName('tool')).toBe('sometool')
      expect(isNextflowRunner('edgev3_nextflow')).toBe(true)
      // The generic name still resolves, so legacy job records keep routing.
      expect(isNextflowRunner('nextflow')).toBe(true)
      expect(isNextflowRunner('sometool')).toBe(false)
    } finally {
      config.NEXTFLOW.RUNNER_NAME = 'nextflow'
    }
  })

  test('job ids are unique per submission so reruns are not deduplicated', () => {
    const proj = { code: 'project-1' }
    expect(generateJobId(proj)).not.toBe(generateJobId(proj))
    expect(generateJobId(proj)).toMatch(/^edge-project-1-/)
  })
})

describe('nextflow submissions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('sends paths and flags rather than a command line', () => {
    mockConf('sra2fastq')
    const submission = buildSubmission(
      { code: 'project-1', type: 'sra2fastq', name: 'SRR1' },
      'edge-project-1-abc',
    )

    expect(submission.runner).toBe('nextflow')
    expect(submission.body).toEqual({
      jobId: 'edge-project-1-abc',
      projectId: 'project-1',
      input: {
        workflowPath: '/workflows/sra2fastq/nextflow/main.nf',
        configPath: '/io/projects/project-1/nextflow.config',
        profile: 'local',
        workDir: '/io/projects/project-1/nextflow/work',
        workPath: '/io/projects/project-1/nextflow/work',
        outputPath: '/io/projects/project-1/output/sra2fastq',
        nextflowLogPath: '/io/projects/project-1/nextflow/.nextflow.log',
        logPath: '/io/projects/project-1/nextflow/job-runner.log',
        donePath: '/io/projects/project-1/nextflow/.job-runner.done',
        runName: 'edge-project-1-abc',
        executor: 'local',
        resume: false,
      },
    })
  })

  test('emits the work directory under both key names for runner interop', () => {
    // Deployed runners disagree: one reads workDir, the other workPath. Both
    // ignore unknown keys, so sending both keeps one upstream compatible.
    mockConf('sra2fastq')
    const submission = buildSubmission(
      { code: 'project-1', type: 'sra2fastq' },
      'job-1',
    )
    const { workDir, workPath } = submission.body.input
    expect(workDir).toBe('/io/projects/project-1/nextflow/work')
    expect(workPath).toBe(workDir)
  })

  test('forwards the executor so the runner decides local vs slurm', () => {
    mockConf('sra2fastq')
    const submission = buildSubmission(
      { code: 'project-1', type: 'sra2fastq' },
      'job-1',
    )
    expect(submission.body.input.executor).toBe('local')
  })

  test('reuses the job id as the nextflow run name', () => {
    mockConf('sra2fastq')
    const submission = buildSubmission(
      { code: 'project-1', type: 'sra2fastq' },
      'edge-project-1-xyz',
    )
    expect(submission.body.input.runName).toBe('edge-project-1-xyz')
  })

  test('omits configPath for workflows with no config template', () => {
    mockConf('profileOnly')
    const submission = buildSubmission(
      { code: 'project-1', type: 'profileOnly' },
      'job-1',
    )
    expect(submission.body.input.configPath).toBeUndefined()
    expect(submission.body.input.profile).toBe('test,local')
  })

  test('honors an absolute nextflow work directory and forwards slurm', () => {
    config.NEXTFLOW.WORK_DIR = '/scratch/nf'
    config.NEXTFLOW.EXECUTOR = 'slurm'
    try {
      mockConf('sra2fastq')
      const submission = buildSubmission(
        { code: 'project-1', type: 'sra2fastq' },
        'job-1',
      )
      expect(submission.body.input.workPath).toBe('/scratch/nf/project-1/work')
      expect(submission.body.input.executor).toBe('slurm')
    } finally {
      config.NEXTFLOW.WORK_DIR = null
      config.NEXTFLOW.EXECUTOR = 'local'
    }
  })

  test('a workflow with neither an entrypoint nor a runner is a permanent error', () => {
    // 'noEntrypoint' declares runner:'nextflow' but no nextflow_main, so it is
    // not a nextflow workflow and has no usable tool runner either.
    mockConf('noEntrypoint')
    expect.assertions(1)
    try {
      buildSubmission({ code: 'project-1', type: 'noEntrypoint' }, 'job-1')
    } catch (error) {
      expect(error.runnerPermanent).toBe(true)
    }
  })

  test('unreadable conf.json is a permanent error', () => {
    fs.readFileSync.mockImplementation(() => {
      throw new Error('ENOENT')
    })
    expect.assertions(1)
    try {
      buildSubmission({ code: 'project-1', type: 'sra2fastq' }, 'job-1')
    } catch (error) {
      expect(error.runnerPermanent).toBe(true)
    }
  })
})

describe('non-nextflow submissions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('delegates tool-specific input to workflow/util generateRunnerInput', () => {
    mockConf('tool')
    const submission = buildSubmission(
      { code: 'project-1', type: 'tool' },
      'job-1',
    )

    expect(submission.runner).toBe('sometool')
    expect(generateRunnerInput).toHaveBeenCalled()
    expect(submission.body.input).toEqual({
      outputPath: '/io/projects/project-1/output/tool',
      logPath: '/io/projects/project-1/log.txt',
      donePath: '/io/projects/project-1/.done',
      inputPath: '/io/public/reads.fastq',
    })
  })
})
