import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { ActivityShape } from '../../shapes'
import { query, RATE_LIMIT_FIELD } from './shared'

export const ACTIVITY_WEEKS = 12
const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS

const COUNTS = {
  issuesOpened: ['issue', 'created'],
  issuesClosed: ['issue', 'closed'],
  pullsOpened: ['pr', 'created'],
  // `closed:` on pull requests includes merged ones, which is what the closure ratio wants.
  pullsClosed: ['pr', 'closed'],
  pullsMerged: ['pr is:merged', 'merged'],
} as const

const STALE_DAYS = 30

/** Today's open counts, each one search. */
const OPEN = {
  pulls: 'is:pr is:open',
  drafts: 'is:pr is:open draft:true',
  awaitingReview: 'is:pr is:open draft:false review:none',
  changesRequested: 'is:pr is:open review:changes_requested',
  issues: 'is:issue is:open',
  staleIssues: 'is:issue is:open updated:<{stale}',
  goodFirstIssues: 'is:issue is:open label:"good first issue","help wanted"',
} as const

type OpenName = keyof typeof OPEN

type CountName = keyof typeof COUNTS

/** Monday 00:00 UTC of the week holding `now`. */
export function weekStartUtc(now: Date): Date {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const sinceMonday = (now.getUTCDay() + 6) % 7
  return new Date(midnight - sinceMonday * DAY_MS)
}

/** Twelve week starts, oldest first, the current partial week last. */
export function activityWeeks(now: Date): Date[] {
  const current = weekStartUtc(now).getTime()
  return Array.from({ length: ACTIVITY_WEEKS }, (_, i) => new Date(current - (ACTIVITY_WEEKS - 1 - i) * WEEK_MS))
}

const searchTime = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z')

/** Last month and this one, UTC: `YYYY-MM` and the search range for each. */
export function activityMonths(now: Date): { month: string; range: string }[] {
  return [1, 0].map(back => {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1))
    const end = back === 0 ? now : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 1000)
    return { month: start.toISOString().slice(0, 7), range: `${searchTime(start)}..${searchTime(end)}` }
  })
}

/** One query of aliased searches: the weekly counts, the monthly merges and today's open counts. One point. */
export function activityQuery(repo: RepoRef, now: Date): string {
  const search = (alias: string, q: string) => `  ${alias}: search(type: ISSUE, query: ${JSON.stringify(`repo:${repo.owner}/${repo.name} ${q}`)}) { issueCount }`
  const weeks = activityWeeks(now).flatMap((start, week) => {
    const range = `${searchTime(start)}..${searchTime(new Date(start.getTime() + WEEK_MS - 1000))}`
    return (Object.keys(COUNTS) as CountName[]).map(count => {
      const [kind, qualifier] = COUNTS[count]
      return search(`w${week}_${count}`, `is:${kind} ${qualifier}:${range}`)
    })
  })
  const months = activityMonths(now).map((m, i) => search(`m${i}_pullsMerged`, `is:pr is:merged merged:${m.range}`))
  const stale = new Date(now.getTime() - STALE_DAYS * DAY_MS).toISOString().slice(0, 10)
  const open = (Object.keys(OPEN) as OpenName[]).map(name => search(`open_${name}`, OPEN[name].replace('{stale}', stale)))
  return `query Activity {\n${[...weeks, ...months, ...open].join('\n')}\n  ${RATE_LIMIT_FIELD}\n}`
}

export type ActivityResponse = Record<string, { issueCount: number }>

export function normalizeActivity(data: ActivityResponse, now: Date): ActivityShape {
  const read = (alias: string) => {
    const result = data[alias]
    // A missing count is a malformed response, never a zero.
    if (!result) throw new Error(`GraphQL activity response is missing ${alias}`)
    return result.issueCount
  }
  return {
    weeks: activityWeeks(now).map((start, week) => ({
      weekStart: start.toISOString(),
      ...(Object.fromEntries((Object.keys(COUNTS) as CountName[]).map(name => [name, read(`w${week}_${name}`)])) as Record<CountName, number>),
    })),
    months: activityMonths(now).map((m, i) => ({ month: m.month, pullsMerged: read(`m${i}_pullsMerged`) })),
    open: Object.fromEntries((Object.keys(OPEN) as OpenName[]).map(name => [name, read(`open_${name}`)])) as ActivityShape['open'],
  }
}

export async function fetchActivity(client: GitHubClient, repo: RepoRef, options: { now: Date }): Promise<ActivityShape> {
  const data = await query<ActivityResponse>(client, 'activity', activityQuery(repo, options.now), {})
  return normalizeActivity(data, options.now)
}
