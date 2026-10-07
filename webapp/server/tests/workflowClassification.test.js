/* eslint-env jest */

const {
  cromwellWorkflows,
  localWorkflows,
  nextflowWorkflows,
  workflowList,
} = require('../workflow/util')
const { queueTypes } = require('../edge-api/utils/conf')

describe('queue types', () => {
  test("the former 'worker' queue name is not accepted", () => {
    // The runner subsystem was never released under the 'worker' name, so no
    // deployed database contains it and no migration is needed.
    expect(queueTypes).not.toContain('worker')
  })

  test('runner-backed jobs use the runner queue', () => {
    expect(queueTypes).toContain('runner')
  })
})

describe('workflow classification', () => {
  test('every nextflow workflow is listed in nextflowWorkflows', () => {
    // Regression guard: this list was once derived from `runner === 'nextflow'`,
    // which silently emptied it whenever a deployment ran nextflow in direct
    // mode and dropped the runner field. The monitor then never picked the
    // workflow up and projects sat in 'in queue' forever.
    const expected = Object.keys(workflowList).filter(
      name => workflowList[name].nextflow_main,
    )
    expect(nextflowWorkflows.sort()).toEqual(expected.sort())
    expect(nextflowWorkflows.length).toBeGreaterThan(0)
  })

  test('classification does not depend on the runner field', () => {
    nextflowWorkflows.forEach(name => {
      expect(workflowList[name].nextflow_main).toBeTruthy()
    })
  })

  test('nextflow entrypoints carry no embedded CLI flags', () => {
    // Both backends build the command line, so flags must live in their own
    // fields. An embedded '-profile local' would be passed as a file path in
    // runner mode.
    nextflowWorkflows.forEach(name => {
      expect(workflowList[name].nextflow_main).not.toMatch(/\s-/)
    })
  })

  test('the three workflow classes are mutually exclusive', () => {
    const all = [...nextflowWorkflows, ...localWorkflows, ...cromwellWorkflows]
    expect(new Set(all).size).toBe(all.length)
  })

  test('every workflow is claimed by exactly one monitor', () => {
    // A workflow in none of the lists is unreachable: no monitor queries it.
    const claimed = new Set([
      ...nextflowWorkflows,
      ...localWorkflows,
      ...cromwellWorkflows,
    ])
    Object.keys(workflowList).forEach(name => {
      expect(claimed.has(name)).toBe(true)
    })
  })

  test('local workflows declare a runner so runner mode can resolve them', () => {
    // In pid mode the runner field is unused, but leaving it off makes a later
    // switch to LOCAL_EXECUTION_MODE=runner fail at submission time.
    localWorkflows.forEach(name => {
      expect(workflowList[name].runner).toBeTruthy()
    })
  })
})
