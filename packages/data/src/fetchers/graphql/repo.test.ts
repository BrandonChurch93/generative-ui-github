import { describe, expect, it } from 'vitest'
import { fixtureClient } from '../../github/fixtures'
import { fetchRepo } from './repo'

describe('fetchRepo', () => {
  it('normalizes vercel/next.js', async () => {
    const { client, misses } = fixtureClient('gql-repo')
    const repo = await fetchRepo(client, { owner: 'vercel', name: 'next.js' })
    expect(repo).toMatchObject({
      owner: 'vercel',
      name: 'next.js',
      license: 'MIT',
      defaultBranch: 'canary',
      defaultBranchSha: '6469906e7909c824f22a165ce858f7f42c978bdd',
      stars: 143039,
      openIssues: 1085,
      primaryLanguage: 'JavaScript',
    })
    expect(repo.topics).toContain('react')
    expect(repo.languages[0]).toEqual({ name: 'JavaScript', bytes: 39593491 })
    expect(repo.languages.map(l => l.bytes)).toEqual([...repo.languages.map(l => l.bytes)].sort((a, b) => b - a))
    expect(misses).toEqual([])
  })
})
