import { describe, expect, it, vi } from 'vitest'
import { cached, cacheKey, kvCache, LIVE_TTL_SECONDS, memoryCache, type KvStore } from './cache'

const repo = { owner: 'vercel', name: 'next.js' }

describe('cache', () => {
  it('serves a second fetch inside 15 minutes from the cache, and loads again after', async () => {
    let t = Date.parse('2026-10-09T12:00:00Z')
    const cache = memoryCache({ now: () => t })
    const load = vi.fn(async () => ({ open: 7 }))
    const key = cacheKey.shape(repo, 'pulls')
    const first = await cached(cache, key, LIVE_TTL_SECONDS, load)
    t += 14 * 60_000
    const second = await cached(cache, key, LIVE_TTL_SECONDS, load)
    expect([first.hit, second.hit]).toEqual([false, true])
    expect(second.cachedAt).toBe('2026-10-09T12:00:00.000Z')
    t += 2 * 60_000
    expect((await cached(cache, key, LIVE_TTL_SECONDS, load)).hit).toBe(false)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('keys stats by the default-branch SHA, so a push misses', () => {
    expect(cacheKey.stats(repo, 'abc123', 'stats.punchCard')).not.toBe(cacheKey.stats(repo, 'def456', 'stats.punchCard'))
    expect(cacheKey.shape({ owner: 'Vercel', name: 'Next.js' }, 'pulls')).toBe('repo:vercel/next.js:pulls')
  })

  it('keeps a sample forever, and hands KV its TTL in seconds', async () => {
    const store: KvStore & { calls: unknown[] } = {
      calls: [],
      async get() {
        return null
      },
      async set(...args: unknown[]) {
        store.calls.push(args)
      },
    }
    const kv = kvCache(store, { now: () => 0 })
    await kv.set('a', 1, LIVE_TTL_SECONDS)
    await kv.set('b', 2, null)
    expect(store.calls).toEqual([
      ['a', { value: 1, cachedAt: '1970-01-01T00:00:00.000Z' }, { ex: 900 }],
      ['b', { value: 2, cachedAt: '1970-01-01T00:00:00.000Z' }, undefined],
    ])
  })
})
