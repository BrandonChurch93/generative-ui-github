import { describe, expect, it } from 'vitest'
import { fixtureClient } from '../../github/fixtures'
import { run } from './community.record'

describe('fetchCommunity', () => {
  it('reads the health percentage and which files exist', async () => {
    const { client, misses } = fixtureClient('rest-community')
    expect(await run(client)).toEqual({
      healthPercentage: 87,
      files: { readme: true, contributing: true, codeOfConduct: true, license: true, issueTemplate: false, pullRequestTemplate: true },
    })
    expect(misses).toEqual([])
  })
})
