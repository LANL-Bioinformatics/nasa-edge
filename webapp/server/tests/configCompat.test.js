/* eslint-env jest */

/**
 * Guards the configuration surface that deployed .env files depend on.
 *
 * These files are bind-mounted and are not regenerated on upgrade, so the
 * variable names they contain must keep working.
 */

const loadConfig = env => {
  jest.resetModules()
  const saved = { ...process.env }
  Object.keys(process.env).forEach(key => {
    if (/^(NEXTFLOW|RUNNER|LOCAL)_/.test(key)) delete process.env[key]
  })
  Object.assign(process.env, { JWT_SECRET: 'x' }, env)
  try {
    // eslint-disable-next-line global-require
    return require('../config')
  } finally {
    process.env = saved
  }
}

describe('nextflow mode inference', () => {
  test('defaults to direct when no runner is configured', () => {
    // Preserves the original behavior for deployments that run the CLI locally.
    expect(loadConfig({}).NEXTFLOW.MODE).toBe('direct')
  })

  test('infers runner mode from NEXTFLOW_RUNNER_API_BASE_URL', () => {
    // Deployments configuring a runner URL often have no nextflow CLI in the
    // web server image, where defaulting to direct would fail at submission.
    const config = loadConfig({
      NEXTFLOW_RUNNER_API_BASE_URL: 'http://nf:7001/v1',
    })
    expect(config.NEXTFLOW.MODE).toBe('runner')
  })

  test('infers runner mode from NEXTFLOW_RUNNER_URL', () => {
    expect(
      loadConfig({ NEXTFLOW_RUNNER_URL: 'http://nf:7001/v1' }).NEXTFLOW.MODE,
    ).toBe('runner')
  })

  test('an explicit mode always wins over inference', () => {
    const config = loadConfig({
      NEXTFLOW_MODE: 'direct',
      NEXTFLOW_RUNNER_API_BASE_URL: 'http://nf:7001/v1',
    })
    expect(config.NEXTFLOW.MODE).toBe('direct')
  })

  test('an empty value falls back to inference rather than erroring', () => {
    expect(loadConfig({ NEXTFLOW_MODE: '' }).NEXTFLOW.MODE).toBe('direct')
  })

  test('rejects an unrecognized mode', () => {
    expect(() => loadConfig({ NEXTFLOW_MODE: 'kubernetes' })).toThrow(
      /NEXTFLOW_MODE must be "direct" or "runner"/,
    )
  })
})

describe('runner service registry', () => {
  test('registers NEXTFLOW_RUNNER_API_BASE_URL under the runner name', () => {
    const config = loadConfig({
      NEXTFLOW_RUNNER_API_BASE_URL: 'http://edgev3_nextflow:7001/v1',
      NEXTFLOW_RUNNER_NAME: 'edgev3_nextflow',
    })
    expect(config.RUNNER.SERVICES).toEqual({
      edgev3_nextflow: { BASE_URL: 'http://edgev3_nextflow:7001/v1' },
    })
  })

  test('defaults that registration to the generic nextflow name', () => {
    const config = loadConfig({
      NEXTFLOW_RUNNER_API_BASE_URL: 'http://nf:7001/v1',
    })
    expect(config.RUNNER.SERVICES.nextflow.BASE_URL).toBe('http://nf:7001/v1')
  })

  test('the generic per-runner form overrides the nextflow-specific one', () => {
    const config = loadConfig({
      NEXTFLOW_RUNNER_API_BASE_URL: 'http://old:7001/v1',
      NEXTFLOW_RUNNER_URL: 'http://new:7001/v1',
    })
    expect(config.RUNNER.SERVICES.nextflow.BASE_URL).toBe('http://new:7001/v1')
  })

  test('registers several runners declaratively', () => {
    const config = loadConfig({
      RUNNER_SERVICES: 'bioai=http://bioai:7001,spades=http://spades:7002',
    })
    expect(config.RUNNER.SERVICES).toEqual({
      bioai: { BASE_URL: 'http://bioai:7001' },
      spades: { BASE_URL: 'http://spades:7002' },
    })
  })

  test('honors NEXTFLOW_RUNNER_API_TIMEOUT_MS', () => {
    const config = loadConfig({ NEXTFLOW_RUNNER_API_TIMEOUT_MS: '15000' })
    expect(config.RUNNER.REQUEST_TIMEOUT_MS).toBe(15000)
  })

  test('the generic timeout takes precedence', () => {
    const config = loadConfig({
      NEXTFLOW_RUNNER_API_TIMEOUT_MS: '15000',
      RUNNER_REQUEST_TIMEOUT_MS: '20000',
    })
    expect(config.RUNNER.REQUEST_TIMEOUT_MS).toBe(20000)
  })

  test('honors NEXTFLOW_RUNNER_API_TOKEN', () => {
    expect(
      loadConfig({ NEXTFLOW_RUNNER_API_TOKEN: 'nf-token' }).RUNNER.API_TOKEN,
    ).toBe('nf-token')
  })
})
