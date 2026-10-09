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
} as const

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

/** One query, 48 aliased searches: issues and pulls, opened and closed, for each of the 12 weeks. */
export function activityQuery(repo: RepoRef, now: Date): string {
  const fields = activityWeeks(now).flatMap((start, week) => {
    const range = `${searchTime(start)}..${searchTime(new Date(start.getTime() + WEEK_MS - 1000))}`
    return (Object.keys(COUNTS) as CountName[]).map(count => {
      const [kind, qualifier] = COUNTS[count]
      const text = JSON.stringify(`repo:${repo.owner}/${repo.name} is:${kind} ${qualifier}:${range}`)
      return `  w${week}_${count}: search(type: ISSUE, query: ${text}) { issueCount }`
    })
  })
  return `query Activity {\n${fields.join('\n')}\n  ${RATE_LIMIT_FIELD}\n}`
}

export type ActivityResponse = Record<string, { issueCount: number }>

export function normalizeActivity(data: ActivityResponse, now: Date): ActivityShape {
  const count = (week: number, name: CountName) => {
    const result = data[`w${week}_${name}`]
    // A missing count is a malformed response, never a zero.
    if (!result) throw new Error(`GraphQL activity response is missing w${week}_${name}`)
    return result.issueCount
  }
  return {
    weeks: activityWeeks(now).map((start, week) => ({
      weekStart: start.toISOString(),
      issuesOpened: count(week, 'issuesOpened'),
      issuesClosed: count(week, 'issuesClosed'),
      pullsOpened: count(week, 'pullsOpened'),
      pullsClosed: count(week, 'pullsClosed'),
    })),
  }
}

export async function fetchActivity(client: GitHubClient, repo: RepoRef, options: { now: Date }): Promise<ActivityShape> {
  const data = await query<ActivityResponse>(client, 'activity', activityQuery(repo, options.now), {})
  return normalizeActivity(data, options.now)
}
