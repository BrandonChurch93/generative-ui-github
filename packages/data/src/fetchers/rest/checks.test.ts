import { describe, expect, it } from 'vitest'
import { fixtureClient } from '../../github/fixtures'
import { run } from './checks.record'

describe('fetchChecks', () => {
  it('follows pages until GitHub stops linking the next one', async () => {
    const { client, misses } = fixtureClient('rest-checks')
    const { ref, runs } = await run(client)
    expect(ref).toBe('6469906e7909c824f22a165ce858f7f42c978bdd')
    expect(runs).toHaveLength(418)
    expect(runs[0]).toEqual({
      name: 'Update and upload Rspack development test manifest',
      status: 'completed',
      conclusion: 'failure',
      startedAt: '2026-10-09T07:11:15Z',
      completedAt: '2026-10-09T07:12:02Z',
    })
    expect(misses).toEqual([])
  })
})
