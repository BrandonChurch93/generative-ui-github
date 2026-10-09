import { describe, expect, it } from 'vitest'
import { fixtureClient } from '../../github/fixtures'
import { fetchPrFiles } from './pr-files'
import { PR_NUMBER, run } from './pr-files.record'
import { NEXT } from './scenario-helpers'

describe('fetchPrFiles', () => {
  it('lists every changed file and is not truncated when the count matches', async () => {
    const { client, misses } = fixtureClient('rest-pr-files')
    const { number, files, truncated } = await run(client)
    expect(number).toBe(PR_NUMBER)
    expect(files).toHaveLength(28)
    expect(files[0]).toMatchObject({ path: 'test/production/app-dir/use-cache-cross-deployment/app/(site)/cached-action/action.ts', status: 'added', additions: 7, deletions: 0 })
    expect(truncated).toBe(false)
    expect(misses).toEqual([])
  })

  it('is truncated when GitHub lists fewer files than the PR changed', async () => {
    const { client } = fixtureClient('rest-pr-files')
    expect((await fetchPrFiles(client, NEXT, PR_NUMBER, { changedFiles: 29 })).truncated).toBe(true)
  })
})
