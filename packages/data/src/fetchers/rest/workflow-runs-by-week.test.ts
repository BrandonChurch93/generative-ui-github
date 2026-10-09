import { describe, expect, it } from 'vitest'
import { fixtureClient } from '../../github/fixtures'
import { NOW, run } from './workflow-runs-by-week.record'
import { weekRanges } from './workflow-runs'

describe('fetchWorkflowRunsByWeek', () => {
  it('finds the CI workflow, reads twelve Monday to Sunday weeks of it, and merges them newest first', async () => {
    const ranges = weekRanges(NOW, 12)
    expect(ranges[0]).toEqual({ from: '2026-07-20', to: '2026-07-26' })
    expect(ranges[11]).toEqual({ from: '2026-10-05', to: '2026-10-11' })

    const { client, misses } = fixtureClient('rest-workflow-runs-by-week')
    const { branch, runs } = await run(client)
    expect(branch).toBe('canary')
    expect(new Set(runs.map(r => r.workflowName))).toEqual(new Set(['build-and-test']))
    expect(runs).toHaveLength(480)
    expect(runs.map(r => r.runStartedAt)).toEqual([...runs.map(r => r.runStartedAt)].sort().reverse())
    expect(runs.at(-1)!.runStartedAt >= '2026-07-20').toBe(true)
    expect(misses).toEqual([])
  })
})
