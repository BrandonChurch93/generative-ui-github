import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import { cacheKey, memoryCache } from './cache/cache'
import { primeSample, readSample, SAMPLE_REPOS } from './samples'

describe('sample repos', () => {
  for (const repo of SAMPLE_REPOS) {
    it(`${repo.owner}/${repo.name} loads into the cache in under 50ms, dated, with no expiry`, async () => {
      // The best of three: the budget is the load's, and one stall while other suites share the CPU is not.
      let elapsed = Infinity
      let cache = memoryCache()
      let sample = readSample(repo)
      let count = 0
      for (let i = 0; i < 3; i++) {
        cache = memoryCache({ now: () => Date.parse('2030-01-01T00:00:00Z') })
        const start = performance.now()
        sample = readSample(repo)
        count = await primeSample(cache, sample)
        elapsed = Math.min(elapsed, performance.now() - start)
      }
      expect(elapsed).toBeLessThan(50)
      expect(count).toBeGreaterThan(10)
      const pulls = await cache.get(cacheKey.shape(repo, 'pulls'))
      expect(pulls?.cachedAt).toBe(sample.entries[cacheKey.shape(repo, 'pulls')]!.cachedAt)
    })
  }
})
