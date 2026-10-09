import { describe, expect, it } from 'vitest'
import { memoryCache, type GitHubClient } from '@genui-github/data/server'
import { countedCache, health } from './health'
import { dayOf, memoryLimits } from './limits'

const github = (rest: GitHubClient['rest']): GitHubClient => ({ rest, graphql: async () => ({}) as never, requests: 0 })

describe('health', () => {
  it('reports the cache hit rate, model calls and spend today, and GitHub rate remaining', async () => {
    const now = Date.parse('2026-10-09T12:00:00Z')
    const cache = countedCache(memoryCache(), () => now)
    await cache.set('a', 1, 60)
    await cache.get('a')
    await cache.get('a')
    await cache.get('b')
    const limits = memoryLimits()
    await limits.addSpend(dayOf(now), 0.002)
    await limits.addSpend(dayOf(now), 0.0005)
    const gh = github(async () => ({ status: 200, headers: {}, data: { resources: { core: { limit: 5000, remaining: 4321, reset: now / 1000 + 600 }, graphql: { limit: 5000, remaining: 4990, reset: now / 1000 + 600 } } } as never }))
    expect(await health({ cache, limits, dailyCapUsd: 5, github: gh }, now)).toEqual({
      cache: { hits: 2, misses: 1, since: '2026-10-09T12:00:00.000Z', hitRate: 0.667 },
      modelCallsToday: 2,
      spendTodayUsd: 0.0025,
      dailyCapUsd: 5,
      github: { rest: { remaining: 4321, limit: 5000, resetAt: '2026-10-09T12:10:00.000Z' }, graphql: { remaining: 4990, limit: 5000, resetAt: '2026-10-09T12:10:00.000Z' } },
    })
  })

  it('says what failed when GitHub cannot be read, and still reports the rest', async () => {
    const gh = github(async () => {
      throw new Error('GitHub returned 502')
    })
    const got = await health({ cache: countedCache(memoryCache()), limits: memoryLimits(), dailyCapUsd: 5, github: gh })
    expect(got.github).toEqual({ error: "Couldn't read GitHub's rate limit · GitHub returned 502" })
    expect(got.cache.hitRate).toBeNull()
  })
})
