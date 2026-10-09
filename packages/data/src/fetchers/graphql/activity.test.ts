import { describe, expect, it } from 'vitest'
import { fixtureClient } from '../../github/fixtures'
import { fetchActivity } from './activity'
import { ACTIVITY_NOW } from './activity.record'

describe('fetchActivity', () => {
  it('counts 12 weeks on vercel/next.js, Monday UTC, oldest first, plus the two months and today\'s open counts', async () => {
    const { client, misses } = fixtureClient('gql-activity')
    const { weeks, months, open } = await fetchActivity(client, { owner: 'vercel', name: 'next.js' }, { now: ACTIVITY_NOW })
    expect(weeks).toHaveLength(12)
    expect(weeks[0]).toEqual({ weekStart: '2026-07-20T00:00:00.000Z', issuesOpened: 49, issuesClosed: 35, pullsOpened: 209, pullsClosed: 143, pullsMerged: 119 })
    expect(months).toEqual([{ month: '2026-09', pullsMerged: 462 }, { month: '2026-10', pullsMerged: 152 }])
    expect(open).toMatchObject({ pulls: 2524, staleIssues: 890 })
    expect(weeks[11]?.weekStart).toBe('2026-10-05T00:00:00.000Z')
    expect(weeks.every(w => new Date(w.weekStart).getUTCDay() === 1)).toBe(true)
    expect(misses).toEqual([])
  })
})
