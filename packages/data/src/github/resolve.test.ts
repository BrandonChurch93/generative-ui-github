import { describe, expect, it } from 'vitest'
import { fixtureClient } from './fixtures'
import { RESOLVE_CASES } from './resolve.record'
import { resolveRepo } from './resolve'

describe('repo resolver', () => {
  it('resolves the ten cases from docs/data-layer.md', async () => {
    const { client, misses } = fixtureClient('resolve')
    for (const [input, expected] of RESOLVE_CASES) {
      const result = await resolveRepo(client, input)
      expect(result.ok ? result.fullName : result.message, JSON.stringify(input)).toBe(expected)
    }
    expect(misses).toEqual([])
  })
})
