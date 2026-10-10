import { describe, expect, it } from 'vitest'
import { busFactor, closureRatio, coreShare, timeToClose, timeToFirstResponse } from './chaoss'
import { computeMeasure } from './compute'
import type { AuthorAssociation, Issue, Person, Pull } from './shapes'

const who = (login: string): Person => ({ login, isBot: login.endsWith('[bot]') })
const window = { since: '2026-09-01T00:00:00Z', until: '2026-10-01T00:00:00Z' }

function pull(login: string, createdAt: string, at: Partial<Pick<Pull, 'firstHumanReviewAt' | 'firstHumanCommentAt' | 'mergedAt'>> = {}, association: AuthorAssociation = 'CONTRIBUTOR'): Pull {
  return {
    number: 1, title: '', url: '', author: who(login), authorAssociation: association, draft: false, labels: [], reviewDecision: null, reviews: [],
    firstHumanReviewAt: at.firstHumanReviewAt ?? null, firstHumanCommentAt: at.firstHumanCommentAt ?? null, createdAt, updatedAt: createdAt,
    mergedAt: at.mergedAt ?? null, closedAt: at.mergedAt ?? null, additions: 0, deletions: 0, changedFiles: 0, milestone: null, headRef: '',
  }
}

function issue(login: string, createdAt: string, at: { comment?: string; closedAt?: string } = {}): Issue {
  return {
    number: 1, title: '', url: '', author: who(login), labels: [], assignees: [], comments: 0, reactions: 0, createdAt, updatedAt: createdAt,
    closedAt: at.closedAt ?? null, milestone: null, firstHumanCommentAt: at.comment ?? null,
  }
}

const pulls = [
  pull('alice', '2026-09-02T00:00:00Z', { firstHumanReviewAt: '2026-09-02T06:00:00Z', firstHumanCommentAt: '2026-09-02T03:00:00Z', mergedAt: '2026-09-04T00:00:00Z' }), // 3h, 2d
  pull('bob', '2026-09-10T00:00:00Z', { mergedAt: '2026-09-10T12:00:00Z' }), // a merge answers: 12h, 0.5d
  pull('dependabot[bot]', '2026-09-11T00:00:00Z', { mergedAt: '2026-09-11T01:00:00Z' }), // never counts
  pull('carol', '2026-09-20T00:00:00Z'), // unanswered
  pull('dave', '2026-08-20T00:00:00Z', { mergedAt: '2026-09-05T00:00:00Z' }), // opened before the window: closes in it, 16d
]
const open = [issue('erin', '2026-09-03T00:00:00Z', { comment: '2026-09-03T09:00:00Z' }), issue('frank', '2026-09-15T00:00:00Z', { comment: '2026-09-16T00:00:00Z' })] // 9h, 24h
const closed = [issue('gil', '2026-09-01T00:00:00Z', { closedAt: '2026-09-08T00:00:00Z' }), issue('hana', '2026-07-01T00:00:00Z', { closedAt: '2026-10-02T00:00:00Z' })] // 7d, outside

describe('CHAOSS metrics, against hand-computed values', () => {
  it('time to first response: 3, 9, 12 and 24 hours give a median of 10.5 and a p90 of 20.4', () => {
    expect(timeToFirstResponse(pulls, open, window)).toEqual({ median: 10.5, p90: expect.closeTo(20.4, 9), count: 4, unanswered: 1 })
  })

  it('time to close: 0.5, 2, 7 and 16 days give a median of 4.5 and a p90 of 13.3', () => {
    expect(timeToClose(pulls, closed, window)).toEqual({ median: 4.5, p90: expect.closeTo(13.3, 9), count: 4 })
  })

  it('closure ratio: 3 of 6, nothing opened, 3 of 2; 6 of 8 overall', () => {
    const week = (weekStart: string, io: number, ic: number, po: number, pc: number) => ({ weekStart, issuesOpened: io, issuesClosed: ic, pullsOpened: po, pullsClosed: pc })
    const result = closureRatio({ weeks: [week('2026-09-07', 4, 1, 2, 2), week('2026-09-14', 0, 0, 0, 0), week('2026-09-21', 1, 2, 1, 1)] })
    expect(result.weeks.map(w => w.ratio)).toEqual([0.5, null, 1.5])
    expect(result.total).toBe(0.75)
  })

  it('closure ratio measure: a week that opened nothing leaves the weekly series out, never a zero', () => {
    const week = (weekStart: string, opened: number, closed: number) => ({ weekStart, issuesOpened: opened, issuesClosed: closed, pullsOpened: 0, pullsClosed: 0, pullsMerged: 0 })
    const weeks = Array.from({ length: 12 }, (_, i) => week(new Date(Date.UTC(2026, 6, 20) + i * 7 * 86_400_000).toISOString(), 4, 2))
    const measure = (w: typeof weeks) => computeMeasure('closure-ratio', { now: Date.UTC(2026, 9, 9), shapes: { activity: { weeks: w, months: [], open: {} } as never }, cachedAt: {} })
    expect(measure(weeks)).toMatchObject({ value: 0.5, formatted: { text: '0.5', suffix: '×' }, series12w: Array(12).fill(0.5) })
    const quiet = measure(weeks.map((w, i) => (i === 4 ? week(w.weekStart, 0, 3) : w)))
    expect(quiet?.value).toBeCloseTo(25 / 44)
    expect(quiet).not.toHaveProperty('series12w')
  })

  it('bus factor: 40, 30, 20 and 10 commits need two people for half, and the bot never counts', () => {
    const result = busFactor([
      { author: who('a'), count: 40 },
      { author: who('renovate[bot]'), count: 500 },
      { author: who('b'), count: 30 },
      { author: who('c'), count: 20 },
      { author: who('d'), count: 10 },
    ])
    expect(result).toMatchObject({ factor: 2, total: 100 })
    expect(result.carriers.map(c => [c.author.login, c.share])).toEqual([['a', 0.4], ['b', 0.3]])
  })

  it('core share from merged pull requests by association, and from participation as the fallback', () => {
    const merged = [
      pull('m', '2026-09-08T00:00:00Z', { mergedAt: '2026-09-08T10:00:00Z' }, 'MEMBER'),
      pull('n', '2026-09-08T00:00:00Z', { mergedAt: '2026-09-09T10:00:00Z' }, 'CONTRIBUTOR'),
      pull('o', '2026-09-15T00:00:00Z', { mergedAt: '2026-09-15T10:00:00Z' }, 'OWNER'),
      pull('vercel[bot]', '2026-09-15T00:00:00Z', { mergedAt: '2026-09-15T11:00:00Z' }, 'MEMBER'),
      pull('p', '2026-09-30T00:00:00Z', { mergedAt: '2026-09-30T10:00:00Z' }, 'FIRST_TIME_CONTRIBUTOR'),
    ]
    expect(coreShare({ merged, weekStarts: ['2026-09-07T00:00:00Z', '2026-09-14T00:00:00Z'] })).toEqual({ weeks: [0.5, 1], total: 2 / 3 })
    expect(coreShare({ participation: { all: [10, 0, 5], owner: [2, 0, 5] } })).toEqual({ weeks: [0.2, null, 1], total: 7 / 15 })
  })
})
