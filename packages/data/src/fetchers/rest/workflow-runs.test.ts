import { describe, expect, it } from 'vitest'
import { fixtureClient } from '../../github/fixtures'
import { run } from './workflow-runs.record'

describe('fetchWorkflowRuns', () => {
  it('maps the 100 latest default-branch runs with duration from start to last update', async () => {
    const { client, misses } = fixtureClient('rest-workflow-runs')
    const { branch, runs } = await run(client)
    expect(branch).toBe('canary')
    expect(runs).toHaveLength(100)
    expect(runs[0]).toEqual({
      id: 37897586640,
      workflowName: 'Update Rspack test manifest',
      status: 'completed',
      conclusion: 'failure',
      runAttempt: 1,
      runStartedAt: '2026-10-09T07:11:13Z',
      updatedAt: '2026-10-09T07:12:03Z',
      durationMs: 50_000,
      headSha: '6469906e7909c824f22a165ce858f7f42c978bdd',
      event: 'schedule',
    })
    expect(misses).toEqual([])
  })
})
