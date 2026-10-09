import { describe, expect, it } from 'vitest'
import { fixtureClient } from '../../github/fixtures'
import { fetchIssues } from './issues'

describe('fetchIssues', () => {
  it('normalizes open and closed issues on vercel/next.js', async () => {
    const { client, misses } = fixtureClient('gql-issues')
    const { open, closed } = await fetchIssues(client, { owner: 'vercel', name: 'next.js' })
    expect(open).toHaveLength(100)
    expect(closed).toHaveLength(50)
    expect(open.map(i => i.updatedAt)).toEqual(open.map(i => i.updatedAt).sort().reverse())
    expect(closed.map(i => i.closedAt)).toEqual(closed.map(i => i.closedAt).sort().reverse())
    expect(open.every(i => i.closedAt === null)).toBe(true)

    // The author's own reply comes first and does not count as a response.
    expect(open[0]).toMatchObject({ number: 99830, author: { login: 'adamtowerz', isBot: false }, comments: 2, reactions: 4 })
    expect(open[0]?.firstHumanCommentAt).toBe('2026-10-09T06:01:17Z')
    expect(closed[0]).toMatchObject({ number: 99870, closedAt: '2026-10-08T14:32:29Z' })
    expect([...open, ...closed].find(i => i.number === 99868)?.author).toEqual({ login: 'cursor', isBot: true })
    expect(misses).toEqual([])
  })
})
