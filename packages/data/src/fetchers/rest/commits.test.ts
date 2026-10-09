import { describe, expect, it } from 'vitest'
import { fixtureClient } from '../../github/fixtures'
import { run, SINCE } from './commits.record'

describe('fetchCommits', () => {
  it('maps commits since the window start, newest first, bots flagged', async () => {
    const { client, misses } = fixtureClient('rest-commits')
    const { since, commits } = await run(client)
    expect(since).toBe(SINCE)
    expect(commits).toHaveLength(93)
    expect(commits[0]).toMatchObject({ sha: '6469906e7909c824f22a165ce858f7f42c978bdd', author: { login: 'next-js-bot[bot]', isBot: true }, date: '2026-10-08T23:25:50Z' })
    expect(commits.some(c => c.author && !c.author.isBot)).toBe(true)
    expect(commits.every(c => c.date >= SINCE)).toBe(true)
    expect(commits.map(c => c.date)).toEqual([...commits.map(c => c.date)].sort().reverse())
    expect(misses).toEqual([])
  })
})
