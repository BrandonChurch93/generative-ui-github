import { describe, expect, it } from 'vitest'
import { fixtureClient } from '../../github/fixtures'
import { fetchPulls } from './pulls'

describe('fetchPulls', () => {
  it('normalizes open and merged pulls on vercel/next.js', async () => {
    const { client, misses } = fixtureClient('gql-pulls')
    const { open, merged } = await fetchPulls(client, { owner: 'vercel', name: 'next.js' })
    expect(open).toHaveLength(50)
    expect(merged).toHaveLength(100)
    expect(open[0]).toMatchObject({ number: 99910, author: { login: 'sokra', isBot: false }, authorAssociation: 'MEMBER', mergedAt: null })
    expect(merged.every(p => p.mergedAt !== null)).toBe(true)
    expect(merged.map(p => p.mergedAt)).toEqual(merged.map(p => p.mergedAt).sort().reverse())
    expect(open.find(p => p.number === 99879)?.author).toEqual({ login: 'next-js-bot', isBot: true })

    // Two bot reviews come first; the first human review is the answer.
    const skipsBots = merged.find(p => p.number === 99858)!
    expect(skipsBots.reviews[0]?.author).toEqual({ login: 'copilot-pull-request-reviewer', isBot: true })
    expect(skipsBots.firstHumanReviewAt).toBe('2026-10-08T12:02:36Z')
    expect(open.find(p => p.number === 99178)?.firstHumanReviewAt).toBe('2026-10-05T13:46:07Z')
    expect(misses).toEqual([])
  })
})
