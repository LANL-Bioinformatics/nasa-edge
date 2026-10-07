/* eslint-env jest */

const { getJobStatus } = require('../utils/nextflowDirect')

describe('nextflow log interpretation (direct mode)', () => {
  const asLog = rows => rows.map(([n, s]) => `${n}\t${s}`).join('\n')

  test('succeeds when every task completed', () => {
    expect(
      getJobStatus(
        asLog([
          ['a', 'COMPLETED'],
          ['b', 'COMPLETED'],
        ]),
      ),
    ).toBe('Succeeded')
  })

  test('uses the last status for a retried task', () => {
    expect(
      getJobStatus(
        asLog([
          ['a', 'FAILED'],
          ['a', 'COMPLETED'],
        ]),
      ),
    ).toBe('Succeeded')
  })

  test('fails when any task did not complete', () => {
    expect(
      getJobStatus(
        asLog([
          ['a', 'COMPLETED'],
          ['b', 'FAILED'],
        ]),
      ),
    ).toBe('Failed')
  })

  test('reports aborted when any task was aborted', () => {
    // The original implementation returned from inside a forEach callback, so
    // ABORTED was silently reported as Failed. This asserts the fix.
    expect(
      getJobStatus(
        asLog([
          ['a', 'COMPLETED'],
          ['b', 'ABORTED'],
        ]),
      ),
    ).toBe('Aborted')
  })

  test('tolerates blank lines and trailing newlines', () => {
    expect(getJobStatus('a\tCOMPLETED\n\nb\tCOMPLETED\n')).toBe('Succeeded')
  })

  test('treats empty output as a failure, not a success', () => {
    expect(getJobStatus('')).toBe('Failed')
  })
})
