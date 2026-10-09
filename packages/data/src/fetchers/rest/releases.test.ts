import { describe, expect, it } from 'vitest'
import { fixtureClient } from '../../github/fixtures'
import { run } from './releases.record'

describe('fetchReleases', () => {
  it('maps the ten latest releases and tags', async () => {
    const { client, misses } = fixtureClient('rest-releases')
    const { releases, tags } = await run(client)
    expect(releases).toHaveLength(10)
    expect(releases[0]).toMatchObject({ name: 'v16.5.0-canary.5', tag: 'v16.5.0-canary.5', publishedAt: '2026-10-08T23:55:20Z', prerelease: true })
    expect(releases[0]?.body.length).toBeGreaterThan(0)
    expect(tags).toHaveLength(10)
    expect(tags[2]).toEqual({ name: 'v16.5.0-canary.5', sha: '6469906e7909c824f22a165ce858f7f42c978bdd' })
    expect(misses).toEqual([])
  })
})
