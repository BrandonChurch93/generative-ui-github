import { describe, expect, it } from 'vitest'
import { fixtureClient } from '../../github/fixtures'
import type { Milestone } from '../../shapes'
import { byDueDate, fetchMilestones } from './milestones'

describe('fetchMilestones', () => {
  it('normalizes the open milestones on vercel/next.js', async () => {
    const { client, misses } = fixtureClient('gql-milestones')
    const { open } = await fetchMilestones(client, { owner: 'vercel', name: 'next.js' })
    expect(open).toEqual([{ number: 17, title: 'backlog', dueOn: null, open: 7, closed: 216 }])
    expect(misses).toEqual([])
  })

  it('puts the soonest due first and undated last', () => {
    const m = (number: number, dueOn: string | null): Milestone => ({ number, title: `m${number}`, dueOn, open: 0, closed: 0 })
    const sorted = [m(1, null), m(2, '2026-12-01T07:00:00Z'), m(3, '2026-11-01T07:00:00Z')].sort(byDueDate)
    expect(sorted.map(s => s.number)).toEqual([3, 2, 1])
  })
})
