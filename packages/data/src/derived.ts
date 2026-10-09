import { busFactor, isBot, median, percentile } from './chaoss'
import type {
  ActivityShape,
  BiggestOpenPrShape,
  BlockingPrsShape,
  BusiestHourShape,
  CiDurationByWeekShape,
  CommitsBetweenTagsShape,
  CompareShape,
  ContributorShareShape,
  ContributorsStatShape,
  FailureRateByWeekShape,
  GoodFirstIssuesShape,
  ISODate,
  Issue,
  IssuesShape,
  MergedByDayShape,
  MilestonesShape,
  MonthCompareShape,
  Person,
  Pull,
  PullsShape,
  PunchCardShape,
  QuietestDayShape,
  RunTimingShape,
  SlowestJobShape,
  StaleIssuesShape,
  WorkflowRun,
  WorkflowRunsShape,
} from './shapes'

// The derived shapes from docs/data-layer.md: computed from fetched shapes, never fetched themselves.

const HOUR = 3_600_000
const DAY = 24 * HOUR
const WEEK = 7 * DAY

/** Monday 00:00 UTC of the week holding `at`. */
export function mondayOf(at: number): number {
  const d = new Date(at)
  const day = (d.getUTCDay() + 6) % 7
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)
}

/** `n` week starts, oldest first, the current partial week last. */
export function weekStarts(now: number, n = 12): number[] {
  const current = mondayOf(now)
  return Array.from({ length: n }, (_, i) => current - (n - 1 - i) * WEEK)
}

const iso = (ms: number) => new Date(ms).toISOString()
const t = (s: ISODate) => Date.parse(s)

const FAILED = new Set(['failure', 'timed_out', 'startup_failure'])
const countsAsRun = (r: WorkflowRun) => r.status === 'completed' && r.conclusion !== 'cancelled' && r.conclusion !== 'skipped' && r.conclusion !== null
export const failed = (r: Pick<WorkflowRun, 'conclusion'>) => r.conclusion !== null && FAILED.has(r.conclusion)

/**
 * "CI" is the workflow with the most push runs on the default branch: the one a maintainer means. Many repos
 * run a dozen small workflows beside it, and mixing their seconds-long runs in would sink the median.
 */
export function mainWorkflow(runs: WorkflowRunsShape): string | null {
  const counts = new Map<string, number>()
  for (const r of runs.runs) if (r.event === 'push') counts.set(r.workflowName, (counts.get(r.workflowName) ?? 0) + 1)
  if (!counts.size) for (const r of runs.runs) counts.set(r.workflowName, (counts.get(r.workflowName) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null
}

export function ciRuns(runs: WorkflowRunsShape, workflow = mainWorkflow(runs)): WorkflowRun[] {
  return runs.runs.filter(r => r.workflowName === workflow && countsAsRun(r))
}

/** Longer than this is a run left waiting or touched later, not a build. */
const LONGEST_RUN_MS = DAY
/** This many runs ending in the same second were touched in bulk by GitHub, after the fact. */
const BULK_TOUCH = 3

/**
 * Runs whose duration can be trusted. A run's end is its `updated_at`, and GitHub sometimes updates old runs in
 * bulk weeks later (on next.js, dozens on Oct 1 at 01:57), which would make them look days long.
 */
export function timedRuns(runs: readonly WorkflowRun[]): WorkflowRun[] {
  const touches = new Map<string, number>()
  for (const r of runs) touches.set(r.updatedAt.slice(0, 19), (touches.get(r.updatedAt.slice(0, 19)) ?? 0) + 1)
  return runs.filter(r => r.durationMs > 0 && r.durationMs <= LONGEST_RUN_MS && (touches.get(r.updatedAt.slice(0, 19)) ?? 0) < BULK_TOUCH)
}

function byWeek<T>(items: readonly T[], at: (item: T) => number, now: number, weeks: number): { weekStart: number; items: T[] }[] {
  return weekStarts(now, weeks).map(start => ({ weekStart: start, items: items.filter(i => at(i) >= start && at(i) < start + WEEK) }))
}

export function ciDurationByWeek(runs: WorkflowRunsShape, options: { now: number; weeks?: number }): CiDurationByWeekShape {
  const workflow = mainWorkflow(runs)
  const all = ciRuns(runs, workflow)
  const timed = new Set(timedRuns(all))
  const weeks = byWeek(all, r => t(r.runStartedAt), options.now, options.weeks ?? 12).map(({ weekStart, items }) => {
    const ms = items.filter(r => timed.has(r)).map(r => r.durationMs)
    return { weekStart: iso(weekStart), p50Ms: median(ms) ?? 0, p90Ms: percentile(ms, 90) ?? 0, count: items.length, failures: items.filter(failed).length }
  })
  return { workflow, weeks }
}

export function failureRateByWeek(runs: WorkflowRunsShape, options: { now: number; weeks?: number }): FailureRateByWeekShape {
  const weeks = byWeek(ciRuns(runs), r => t(r.runStartedAt), options.now, options.weeks ?? 12).map(({ weekStart, items }) => {
    const failures = items.filter(failed).length
    return { weekStart: iso(weekStart), runs: items.length, failures, rate: items.length ? failures / items.length : 0 }
  })
  return { weeks }
}

/** How far back the slowest run is looked for: the slowest-job metric's window, and inside GitHub's job retention. */
export const SLOWEST_RUN_DAYS = 30

/** The run worth drilling into: the slowest completed run of the CI workflow in the last 30 days. */
export function slowestRun(runs: WorkflowRunsShape, options: { now: number }): WorkflowRun | null {
  const since = options.now - SLOWEST_RUN_DAYS * DAY
  return timedRuns(ciRuns(runs))
    .filter(r => t(r.runStartedAt) >= since)
    .reduce<WorkflowRun | null>((max, r) => (!max || r.durationMs > max.durationMs ? r : max), null)
}

export function slowestJob(run: WorkflowRun, timing: RunTimingShape): SlowestJobShape | null {
  const job = timing.jobs.reduce<RunTimingShape['jobs'][number] | null>((max, j) => (!max || j.durationMs > max.durationMs ? j : max), null)
  return job ? { runId: run.id, workflowName: run.workflowName, job: job.name, durationMs: job.durationMs } : null
}

export const STALE_DAYS = 30

export function staleIssues(issues: IssuesShape, options: { now: number; days?: number }): StaleIssuesShape {
  const days = options.days ?? STALE_DAYS
  const stale = issues.open
    .map(i => ({ ...i, lastActivityAt: i.updatedAt, idleDays: Math.floor((options.now - t(i.updatedAt)) / DAY) }))
    .filter(i => i.idleDays >= days)
    .sort((a, b) => b.idleDays - a.idleDays || a.number - b.number)
  return { issues: stale }
}

const GOOD_FIRST = [/good.first/i, /help.wanted/i]

export function goodFirstIssues(issues: IssuesShape): GoodFirstIssuesShape {
  return { issues: issues.open.filter(i => i.labels.some(l => GOOD_FIRST.some(re => re.test(l)))).sort((a, b) => t(b.createdAt) - t(a.createdAt)) }
}

export const prSize = (p: Pick<Pull, 'additions' | 'deletions'>) => p.additions + p.deletions

export function biggestOpenPr(pulls: PullsShape): BiggestOpenPrShape {
  const humans = pulls.open.filter(p => !isBot(p.author))
  const ready = humans.filter(p => !p.draft)
  const pool = ready.length ? ready : humans
  return { pull: pool.reduce<Pull | null>((max, p) => (!max || prSize(p) > prSize(max) ? p : max), null) }
}

/**
 * The next release milestone: the open one due soonest. An undated milestone is a bucket ("backlog"), not a
 * release, so a repo with only undated ones has no next milestone.
 */
export function nextMilestone(milestones: MilestonesShape): MilestonesShape['open'][number] | null {
  return [...milestones.open].filter(m => m.dueOn !== null).sort((a, b) => t(a.dueOn!) - t(b.dueOn!))[0] ?? null
}

/** The merged-pull list holds the latest 100; when full, nothing merged before its oldest entry is in it. */
export const MERGED_LISTED = 100
/** The closed-issue list holds the latest 50. */
export const CLOSED_LISTED = 50

/** From when the pull and issue lists are complete. Earlier than this, they hold only a few long-lived items. */
export function listCoverage(pulls: PullsShape | undefined, issues?: IssuesShape): number {
  const oldest = (dates: (ISODate | null)[]) => Math.min(...dates.filter((d): d is ISODate => d !== null).map(t))
  let from = -Infinity
  if (pulls && pulls.merged.length >= MERGED_LISTED) from = Math.max(from, oldest(pulls.merged.map(p => p.mergedAt)))
  if (issues && issues.closed.length >= CLOSED_LISTED) from = Math.max(from, oldest(issues.closed.map(i => i.closedAt)))
  return from
}

/** How long a pull request has waited on its reviewers: since it opened, or since the last review when one came. */
export function waitingMs(p: Pull, now: number): number {
  const lastReview = p.reviews.filter(r => !isBot(r.author) && r.author.login !== p.author.login).reduce((max, r) => Math.max(max, t(r.submittedAt)), 0)
  return now - (lastReview || t(p.createdAt))
}

/**
 * Open pull requests on the next milestone, longest wait first. A repo without milestones has no release
 * to block, so the open ready pull requests stand in, and `milestone` is null to say so.
 */
export function blockingPrs(pulls: PullsShape, milestones: MilestonesShape, options: { now: number; limit?: number }): BlockingPrsShape {
  const milestone = nextMilestone(milestones)
  const pool = pulls.open.filter(p => !isBot(p.author) && (milestone ? p.milestone === milestone.title : !p.draft))
  const sorted = pool.map(p => ({ ...p, waitingMs: waitingMs(p, options.now) })).sort((a, b) => b.waitingMs - a.waitingMs)
  return { milestone, pulls: sorted.slice(0, options.limit ?? 20) }
}

export function commitsBetweenTags(compare: CompareShape): CommitsBetweenTagsShape {
  return { base: compare.base, head: compare.head, commits: compare.commits, files: compare.files, totals: compare.totals }
}

export function busiestHour(punch: PunchCardShape): BusiestHourShape {
  const hours = Array.from({ length: 24 }, (_, h) => punch.cells.filter(c => c.hour === h).reduce((n, c) => n + c.commits, 0))
  const hour = hours.reduce((best, n, h) => (n > hours[best]! ? h : best), 0)
  return { hour, commits: hours[hour]!, timeZone: punch.timeZone }
}

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

export function quietestDay(punch: PunchCardShape): QuietestDayShape {
  const days = WEEKDAYS.map((_, d) => punch.cells.filter(c => c.day === d).reduce((n, c) => n + c.commits, 0))
  const day = days.reduce((best, n, d) => (n < days[best]! ? d : best), 0)
  return { day, name: WEEKDAYS[day]!, commits: days[day]! }
}

/** The calendar date in `timeZone`, as YYYY-MM-DD. */
export function localDate(at: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at))
}

export function mergedByDay(pulls: PullsShape, options: { now: number; days: number; timeZone: string; window: string }): MergedByDayShape {
  const since = options.now - options.days * DAY
  const groups = new Map<string, Pull[]>()
  for (const p of pulls.merged) {
    if (!p.mergedAt || t(p.mergedAt) < since || t(p.mergedAt) > options.now) continue
    const date = localDate(t(p.mergedAt), options.timeZone)
    groups.set(date, [...(groups.get(date) ?? []), p])
  }
  const days = [...groups]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, list]) => ({ date, pulls: list.sort((a, b) => t(b.mergedAt!) - t(a.mergedAt!)) }))
  return { window: options.window, timeZone: options.timeZone, days }
}

const RANK_DAYS = 90

/** Commits from the contributor stats, reviews from merged pull requests, both over the last 90 days (decision 45). */
export function contributorShare(stats: ContributorsStatShape, pulls: PullsShape, options: { now: number }): ContributorShareShape {
  const since = options.now - RANK_DAYS * DAY
  const share = (work: { author: Person; count: number }[]) => {
    const { total } = busFactor(work)
    return work
      .filter(w => !isBot(w.author) && w.count > 0)
      .sort((a, b) => b.count - a.count || a.author.login.localeCompare(b.author.login))
      .map(w => ({ ...w, share: total ? w.count / total : 0 }))
  }
  const commits = stats.authors.map(a => ({ author: a.author, count: a.weeks.filter(w => t(w.weekStart) >= mondayOf(since)).reduce((n, w) => n + w.commits, 0) }))
  const reviews = new Map<string, { author: Person; count: number }>()
  for (const p of pulls.merged) {
    if (!p.mergedAt || t(p.mergedAt) < since) continue
    for (const r of p.reviews) {
      if (isBot(r.author) || r.author.login === p.author.login || t(r.submittedAt) < since) continue
      const entry = reviews.get(r.author.login) ?? { author: r.author, count: 0 }
      entry.count += 1
      reviews.set(r.author.login, entry)
    }
  }
  return { window: '90d', commits: share(commits), reviews: share([...reviews.values()]) }
}

/** Hours from opening to the first human review, comment or merge, for pull requests opened in [from, to). */
export function reviewWaitHours(pulls: readonly Pull[], from: number, to: number): number[] {
  return pulls
    .filter(p => !isBot(p.author) && t(p.createdAt) >= from && t(p.createdAt) < to)
    .flatMap(p => {
      const answers = [p.firstHumanReviewAt, p.firstHumanCommentAt, p.mergedAt].filter((x): x is string => x !== null).map(t)
      return answers.length ? [(Math.min(...answers) - t(p.createdAt)) / HOUR] : []
    })
}

/** Days from opening to merge or close, for what closed in [from, to). */
export function closeDays(pulls: readonly Pull[], issues: readonly Issue[], from: number, to: number): number[] {
  const ends = [
    ...pulls.filter(p => !isBot(p.author)).map(p => [p.createdAt, p.mergedAt ?? p.closedAt] as const),
    ...issues.filter(i => !isBot(i.author)).map(i => [i.createdAt, i.closedAt] as const),
  ]
  return ends.filter(([, end]) => end !== null && t(end) >= from && t(end) < to).map(([start, end]) => (t(end!) - t(start)) / DAY)
}

function monthStart(at: number, back = 0): number {
  const d = new Date(at)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1)
}

const monthName = (at: number) => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(at))

/** This month so far against all of last month, four measures. Merges are exact counts; the medians need the lists to reach back. */
export function monthCompare(pulls: PullsShape, issues: IssuesShape, runs: WorkflowRunsShape, activity: ActivityShape | undefined, options: { now: number }): MonthCompareShape {
  const ci = ciRuns(runs)
  const pullsAll = [...pulls.open, ...pulls.merged]
  const listed = listCoverage(pulls, issues)
  const runsFrom = ci.length ? Math.min(...ci.map(r => t(r.runStartedAt))) : Infinity
  const values = (from: number, to: number, month: string) => {
    const monthRuns = ci.filter(r => t(r.runStartedAt) >= from && t(r.runStartedAt) < to)
    const covered = listed <= from
    return {
      'prs-merged': activity?.months.find(m => m.month === month)?.pullsMerged ?? null,
      'review-wait-median': covered ? median(reviewWaitHours(pullsAll, from, to)) : null,
      'failing-check-rate': runsFrom <= from + 7 * DAY && monthRuns.length ? (monthRuns.filter(failed).length / monthRuns.length) * 100 : null,
      'time-to-close-median': covered ? median(closeDays(pulls.merged, issues.closed, from, to)) : null,
    }
  }
  const current = monthStart(options.now)
  const previous = monthStart(options.now, 1)
  const key = (ms: number) => new Date(ms).toISOString().slice(0, 7)
  return {
    current: { month: monthName(current), values: values(current, options.now, key(current)) },
    previous: { month: monthName(previous), values: values(previous, current, key(previous)) },
  }
}
