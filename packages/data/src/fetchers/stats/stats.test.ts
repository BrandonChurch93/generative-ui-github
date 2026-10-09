import { describe, expect, it } from 'vitest'
import { fixtureClient } from '../../github/fixtures'
import { fetchCodeFrequency } from './codeFrequency'
import { fetchCommitActivity } from './commitActivity'
import { CONTRIBUTOR_WEEKS, fetchContributorsStat } from './contributors'
import { fetchParticipation } from './participation'
import { fetchPunchCard } from './punchCard'
import { COUNTING } from './request'
import { NEXT, settle, SMALL } from './stats.record'

const noWait = async () => {}

function ready<T>(result: T | typeof COUNTING | 'unavailable'): T {
  if (result === COUNTING || result === 'unavailable') throw new Error(`expected data, got ${result}`)
  return result
}

describe('stats fetchers on vercel/next.js', () => {
  it('commit activity: 52 weeks of seven days, Sunday first, oldest first', async () => {
    const { client, misses } = fixtureClient('stats-nextjs')
    const { weeks } = ready(await settle(() => fetchCommitActivity(client, NEXT), noWait))
    expect(weeks).toHaveLength(52)
    expect(weeks.at(-1)).toEqual({ weekStart: '2026-10-04T00:00:00.000Z', days: [3, 37, 43, 35, 13, 0, 0], total: 131 })
    expect(new Date(weeks[0]!.weekStart).getUTCDay()).toBe(0)
    expect(weeks.every(w => w.days.reduce((a, b) => a + b, 0) === w.total)).toBe(true)
    expect(misses).toEqual([])
  })

  it('code frequency: 422 on next.js is unavailable, and a small repo gives weekly lines with deletions positive', async () => {
    const { client, misses } = fixtureClient('stats-nextjs')
    expect(await settle(() => fetchCodeFrequency(client, NEXT), noWait)).toBe('unavailable')
    const { weeks } = ready(await settle(() => fetchCodeFrequency(client, SMALL), noWait))
    expect(weeks).toHaveLength(762)
    expect(weeks[0]).toEqual({ weekStart: '2012-03-04T00:00:00.000Z', additions: 9429, deletions: 6 })
    expect(misses).toEqual([])
  })

  it('participation: all and owner, 52 weeks each, oldest first', async () => {
    const { client, misses } = fixtureClient('stats-nextjs')
    const { all, owner } = ready(await settle(() => fetchParticipation(client, NEXT), noWait))
    expect([all.length, owner.length]).toEqual([52, 52])
    expect([all[0], all[51]]).toEqual([119, 145])
    expect(owner.every((n, i) => n <= all[i]!)).toBe(true)
    expect(misses).toEqual([])
  })

  it('punch card: 168 cells, Monday first, every commit kept through a zone shift', async () => {
    const { client, misses } = fixtureClient('stats-nextjs')
    const utc = ready(await settle(() => fetchPunchCard(client, NEXT), noWait))
    expect(utc.cells).toHaveLength(168)
    expect(utc.cells[0]).toMatchObject({ day: 0, hour: 0 })
    expect(utc.cells.find(c => c.day === 0 && c.hour === 14)?.commits).toBe(264)
    expect(utc.cells.find(c => c.day === 6 && c.hour === 0)?.commits).toBe(10)
    const { client: again } = fixtureClient('stats-nextjs')
    const tokyo = ready(await fetchPunchCard(again, NEXT, 'Asia/Tokyo', Date.parse('2026-10-09T00:00:00Z')))
    const sum = (card: typeof utc) => card.cells.reduce((a, c) => a + c.commits, 0)
    expect(tokyo.timeZone).toBe('Asia/Tokyo')
    expect(sum(tokyo)).toBe(sum(utc))
    expect(tokyo.cells.find(c => c.day === 0 && c.hour === 23)?.commits).toBe(264)
    expect(misses).toEqual([])
  })

  it('contributors: most commits first, only weeks with work in the last 52, bots flagged', async () => {
    const { client, misses } = fixtureClient('stats-nextjs')
    const { authors } = ready(await settle(() => fetchContributorsStat(client, NEXT), noWait))
    expect(authors[0]).toMatchObject({ author: { login: 'ijjk', isBot: false }, total: 4633 })
    expect(authors.every((a, i) => i === 0 || authors[i - 1]!.total >= a.total)).toBe(true)
    expect(authors.every(a => a.weeks.length <= CONTRIBUTOR_WEEKS && a.weeks.every(w => w.commits + w.additions + w.deletions > 0))).toBe(true)
    expect(authors[0]!.weeks.every(w => w.weekStart >= '2025-10-12')).toBe(true)
    const flag = (login: string) => authors.find(a => a.author.login === login)?.author.isBot
    expect([flag('dependabot[bot]'), flag('kodiakhq[bot]'), flag('nextjs-bot'), flag('vercel-release-bot'), flag('ijjk')]).toEqual([true, true, true, true, false])
    expect(misses).toEqual([])
  })
})
