import { describe, expect, it } from 'vitest'
import { cacheKey, memoryCache } from '../../cache/cache'
import { fixtureClient } from '../../github/fixtures'
import type { WarmingStatus } from '../../shapes'
import { checkStats, LAST_COPY, type StatShapeName } from './check'
import { CHECK_SCHEDULE } from './schedule'

// `stats-warming` is handwritten in the recording format: GitHub's 202s cannot be summoned on demand.
const t0 = Date.parse('2026-10-09T12:00:00Z')
const iso = (ms: number) => new Date(ms).toISOString()

describe('checkStats', () => {
  it('a 202, 202, 200 sequence yields warming twice then data, with the right nextCheckMs each time', async () => {
    const { client, misses } = fixtureClient('stats-warming')
    const repo = { owner: 'genui-github-fixtures', name: 'warming' }
    let t = t0
    const check = (previous: WarmingStatus | null) => checkStats(client, repo, ['stats.commitActivity'], previous, { now: () => t })

    const first = await check(null)
    expect(first.status).toEqual({
      repo: 'genui-github-fixtures/warming',
      phase: 'warming',
      attempt: 1,
      nextCheckMs: 4000,
      startedAt: iso(t0),
      elapsedMs: 0,
      stats: [{ id: 'commit_activity', state: 'counting' }],
    })
    expect(first.data).toEqual({})

    t = t0 + first.status!.nextCheckMs
    const second = await check(first.status)
    expect(second.status).toMatchObject({ phase: 'warming', attempt: 2, nextCheckMs: 6000, elapsedMs: 4000, startedAt: iso(t0) })

    t += second.status!.nextCheckMs
    const third = await check(second.status)
    expect(third.status).toBeNull()
    expect(third.data['stats.commitActivity']).toMatchObject({ cachedAt: iso(t0 + 10_000), weeks: [{ total: 3 }, { total: 5 }] })
    expect(client.requests).toBe(3)
    expect(misses).toEqual([])
  })

  it('stops after the 120s check: a stat with a copy is cached and dated, one without is missing', async () => {
    const { client, misses } = fixtureClient('stats-warming')
    const repo = { owner: 'genui-github-fixtures', name: 'slow' }
    let t = Date.parse('2026-10-05T09:30:00Z')
    const cache = memoryCache({ now: () => t })
    await cache.set(cacheKey.stats(repo, LAST_COPY, 'stats.participation'), { all: [4, 6], owner: [1, 0] }, null)
    const shapes: StatShapeName[] = ['stats.commitActivity', 'stats.participation', 'stats.punchCard', 'stats.codeFrequency']

    let status: WarmingStatus | null = null
    const seen: [WarmingStatus['phase'], number, number][] = []
    let result
    for (const s of CHECK_SCHEDULE) {
      t = t0 + s * 1000
      result = await checkStats(client, repo, shapes, status, { now: () => t, cache, sha: 'b4c0ffee' })
      status = result.status
      seen.push([status!.phase, status!.attempt, status!.nextCheckMs])
    }
    const gaps = [4000, 6000, 8000, 10000, 12000, 14000, 16000, 20000, 30000, 0]
    expect(seen).toEqual(gaps.map((next, i) => [i < 9 ? 'warming' : 'stopped', i + 1, next]))
    expect(status).toEqual({
      repo: 'genui-github-fixtures/slow',
      phase: 'stopped',
      attempt: 10,
      nextCheckMs: 0,
      startedAt: iso(t0),
      elapsedMs: 120_000,
      stats: [
        { id: 'commit_activity', state: 'ready', landedAt: iso(t0 + 10_000) },
        { id: 'participation', state: 'cached', cachedAt: '2026-10-05T09:30:00.000Z' },
        { id: 'punch_card', state: 'missing' },
      ],
    })
    expect(result!.data['stats.participation']).toEqual({ all: [4, 6], owner: [1, 0], cachedAt: '2026-10-05T09:30:00.000Z' })
    expect(result!.data['stats.punchCard']).toBeUndefined()
    expect(result!.unavailable).toEqual(['stats.codeFrequency'])
    // Four requests a check until commit activity lands at 10s; after that it comes from the cache.
    expect(client.requests).toBe(3 * 4 + 7 * 3)
    expect(misses).toEqual([])
  })
})
