import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import { cacheKey, memoryCache } from './cache/cache'
import { primeSample, readSample, SAMPLE_REPOS } from './samples'

describe('sample repos', () => {
  for (const repo of SAMPLE_REPOS) {
    it(`${repo.owner}/${repo.name} loads into the cache in under 50ms, dated, with no expiry`, async () => {
      const cache = memoryCache({ now: () => Date.parse('2030-01-01T00:00:00Z') })
      const start = performance.now()
      const sample = readSample(repo)
      const count = await primeSample(cache, sample)
      const elapsed = performance.now() - start
      expect(elapsed).toBeLessThan(50)
      expect(count).toBeGreaterThan(10)
      const pulls = await cache.get(cacheKey.shape(repo, 'pulls'))
      expect(pulls?.cachedAt).toBe(sample.entries[cacheKey.shape(repo, 'pulls')]!.cachedAt)
    })
  }
})
