import { describe, expect, it } from 'vitest'
import { fixtureClient } from '../../github/fixtures'
import { run } from './compare.record'

describe('fetchCompare', () => {
  it('compares the two latest release tags with totals over the files', async () => {
    const { client, misses } = fixtureClient('rest-compare')
    const compare = await run(client)
    expect(compare).toMatchObject({ base: 'v16.5.0-canary.4', head: 'v16.5.0-canary.5', aheadBy: 4 })
    expect(compare.commits).toHaveLength(4)
    expect(compare.commits[0]?.sha).toBe('619d36f519f50d499df099c0a6c86a3bd586b742')
    expect(compare.files[0]?.path).toBe('packages/create-next-app/package.json')
    expect(compare.totals).toEqual({ additions: 98, deletions: 34, changedFiles: 25 })
    expect(misses).toEqual([])
  })
})
