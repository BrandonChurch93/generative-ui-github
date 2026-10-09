import { describe, expect, it } from 'vitest'
import { fixtureClient } from '../../github/fixtures'
import { run } from './run-timing.record'

describe('fetchRunTiming', () => {
  it('gives job and step durations for the slowest recent run', async () => {
    const { client, misses } = fixtureClient('rest-run-timing')
    const { runId, jobs } = await run(client)
    expect(runId).toBe(37887375021)
    expect(jobs).toHaveLength(36)
    const slowest = [...jobs].sort((a, b) => b.durationMs - a.durationMs)[0]
    expect(slowest?.name).toBe('Rspack integration tests / Next.js integration test (E2E and development) (13/16) / build')
    expect(slowest?.durationMs).toBe(1_245_000)
    expect(slowest?.steps).toHaveLength(46)
    expect(slowest?.steps[0]).toEqual({ name: 'Set up job', durationMs: 2000 })
    expect(misses).toEqual([])
  })
})
