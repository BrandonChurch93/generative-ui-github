import { isBotLogin } from './github/person'
import type { ActivityShape, AuthorAssociation, ISODate, Issue, ParticipationShape, Person, Pull } from './shapes'

// The CHAOSS metrics from docs/data-layer.md, computed from the shapes. Bots never count: not as authors,
// not as responders.

const HOUR = 3_600_000
const DAY = 24 * HOUR

export interface Window {
  since: ISODate
  until: ISODate
}

export function isBot(person: Person | null | undefined): boolean {
  return !person || person.isBot || isBotLogin(person.login)
}

const t = (iso: ISODate) => Date.parse(iso)
const within = (iso: ISODate | null, w: Window) => iso !== null && t(iso) >= t(w.since) && t(iso) < t(w.until)

/** Linear interpolation between closest ranks, the definition spreadsheets use. Null for no values. */
export function percentile(values: readonly number[], p: number): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const rank = (p / 100) * (sorted.length - 1)
  const low = Math.floor(rank)
  const high = Math.ceil(rank)
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (rank - low)
}

export const median = (values: readonly number[]) => percentile(values, 50)

export interface Spread {
  median: number | null
  p90: number | null
  /** Items measured. */
  count: number
}

const earliest = (...times: (ISODate | null)[]) => {
  const valid = times.filter((x): x is ISODate => x !== null).map(t)
  return valid.length ? Math.min(...valid) : null
}

/**
 * Time to first response, in hours, for issues and pull requests opened in the window: opened to the first
 * comment, review or merge by a human other than the author. Items not yet answered are counted apart.
 */
export function timeToFirstResponse(pulls: readonly Pull[], issues: readonly Issue[], window: Window): Spread & { unanswered: number } {
  const hours: number[] = []
  let unanswered = 0
  const add = (created: ISODate, response: number | null) => {
    if (response === null) unanswered += 1
    else hours.push((response - t(created)) / HOUR)
  }
  for (const p of pulls) if (!isBot(p.author) && within(p.createdAt, window)) add(p.createdAt, earliest(p.firstHumanReviewAt, p.firstHumanCommentAt, p.mergedAt))
  for (const i of issues) if (!isBot(i.author) && within(i.createdAt, window)) add(i.createdAt, earliest(i.firstHumanCommentAt))
  return { median: median(hours), p90: percentile(hours, 90), count: hours.length, unanswered }
}

/** Closed (merged or closed) divided by opened, per week and over the whole span. Below 1 is falling behind. */
export function closureRatio(activity: ActivityShape): { weeks: { weekStart: ISODate; ratio: number | null }[]; total: number | null } {
  const ratio = (closed: number, opened: number) => (opened === 0 ? null : closed / opened)
  const weeks = activity.weeks.map(w => ({ weekStart: w.weekStart, ratio: ratio(w.issuesClosed + w.pullsClosed, w.issuesOpened + w.pullsOpened) }))
  const sum = (f: (w: ActivityShape['weeks'][number]) => number) => activity.weeks.reduce((n, w) => n + f(w), 0)
  return { weeks, total: ratio(sum(w => w.issuesClosed + w.pullsClosed), sum(w => w.issuesOpened + w.pullsOpened)) }
}

/** Opened to merged or closed, in days, for what closed in the window. */
export function timeToClose(merged: readonly Pull[], closedIssues: readonly Issue[], window: Window): Spread {
  const days: number[] = []
  for (const p of merged) {
    const end = p.mergedAt ?? p.closedAt
    if (!isBot(p.author) && within(end, window)) days.push((t(end!) - t(p.createdAt)) / DAY)
  }
  for (const i of closedIssues) if (!isBot(i.author) && within(i.closedAt, window)) days.push((t(i.closedAt!) - t(i.createdAt)) / DAY)
  return { median: median(days), p90: percentile(days, 90), count: days.length }
}

export interface Carrier {
  author: Person
  count: number
  share: number
}

/**
 * The smallest number of people whose work (commits or reviews) makes half the total. In prose the system
 * calls it the bus factor; CHAOSS calls it the contributor absence factor.
 */
export function busFactor(work: readonly { author: Person; count: number }[], threshold = 0.5): { factor: number; total: number; carriers: Carrier[] } {
  const humans = work.filter(w => !isBot(w.author) && w.count > 0).sort((a, b) => b.count - a.count)
  const total = humans.reduce((n, w) => n + w.count, 0)
  const carriers: Carrier[] = []
  let sum = 0
  for (const w of humans) {
    if (total === 0 || sum / total >= threshold) break
    sum += w.count
    carriers.push({ ...w, share: w.count / total })
  }
  return { factor: carriers.length, total, carriers }
}

export const CORE_ASSOCIATIONS: ReadonlySet<AuthorAssociation> = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])

/**
 * Core vs community share of the work, 0 to 1 per week, oldest first. For an organization's repo, GitHub's
 * participation `owner` counts only the organization account's own commits, so the core team is read from
 * who authored the merged pull requests instead; participation is the fallback when there are none.
 */
export function coreShare(
  input: { merged: readonly Pull[]; weekStarts: readonly ISODate[] } | { participation: ParticipationShape },
): { weeks: (number | null)[]; total: number | null } {
  if ('participation' in input) {
    const { all, owner } = input.participation
    const weeks = all.map((n, i) => (n === 0 ? null : (owner[i] ?? 0) / n))
    const sumAll = all.reduce((a, b) => a + b, 0)
    return { weeks, total: sumAll === 0 ? null : owner.reduce((a, b) => a + b, 0) / sumAll }
  }
  const starts = input.weekStarts.map(t)
  const core = starts.map(() => 0)
  const all = starts.map(() => 0)
  for (const p of input.merged) {
    if (isBot(p.author) || !p.mergedAt) continue
    const at = t(p.mergedAt)
    const week = starts.findLastIndex(s => s <= at)
    if (week < 0 || at >= starts[week]! + 7 * DAY) continue
    all[week]! += 1
    if (CORE_ASSOCIATIONS.has(p.authorAssociation)) core[week]! += 1
  }
  const sumAll = all.reduce((a, b) => a + b, 0)
  return { weeks: all.map((n, i) => (n === 0 ? null : core[i]! / n)), total: sumAll === 0 ? null : core.reduce((a, b) => a + b, 0) / sumAll }
}
