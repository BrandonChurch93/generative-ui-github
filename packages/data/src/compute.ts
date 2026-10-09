import { busFactor, closureRatio, CORE_ASSOCIATIONS, coreShare, isBot, median, percentile } from './chaoss'
import { ciRuns, closeDays, failed, listCoverage, timedRuns, mainWorkflow, mondayOf, nextMilestone, prSize, reviewWaitHours, weekStarts } from './derived'
import { formatValue, MEASURES, type MeasureId, type MeasureResult, type MeasureUnit, type UnitValue } from './measures'
import type { ISODate, Pull, ShapeMap, ShapeName, WorkflowRun } from './shapes'

// Every measure in the catalog, computed from the shapes for a repo and a window. Nothing here fetches.

const HOUR = 3_600_000
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const t = (s: ISODate) => Date.parse(s)

export type MeasureWindow = '7d' | '14d' | '30d' | '90d' | '4w' | '12w' | '52w' | 'week' | 'month' | 'milestone'

export interface MeasureScope {
  milestone?: string
  pr?: number
  author?: string
  /** Between the last two releases: commits, contributors and files come from the compare. */
  release?: boolean
}

export interface MeasureContext {
  now: number
  shapes: Partial<ShapeMap>
  /** When each shape was fetched; a measure carries the oldest of the copies it read. */
  cachedAt: Partial<Record<ShapeName, ISODate>>
  scope?: MeasureScope
}

/** The window as a time span. `milestone` means everything the shapes hold for it, so 90 days. */
export function windowSpan(window: MeasureWindow, now: number): { from: number; to: number } {
  const days: Partial<Record<MeasureWindow, number>> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90, '4w': 28, '12w': 84, '52w': 364, milestone: 90 }
  if (window === 'week') return { from: mondayOf(now), to: now }
  if (window === 'month') {
    const d = new Date(now)
    return { from: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1), to: now }
  }
  return { from: now - days[window]! * DAY, to: now }
}

type Value<Id extends MeasureId> = UnitValue[MeasureUnit<Id>]

interface Impl<Id extends MeasureId> {
  needs: ShapeName[]
  window: MeasureWindow
  compute(s: Partial<ShapeMap>, ctx: MeasureContext, span: { from: number; to: number }): { value: Value<Id>; series12w?: number[]; coveredFrom?: number } | null
}

/** A window cut to where the lists are complete, and whether it was cut. */
function covered(span: { from: number; to: number }, from: number): { span: { from: number; to: number }; coveredFrom?: number; series: boolean } {
  return from > span.from ? { span: { from, to: span.to }, coveredFrom: from, series: false } : { span, series: from <= weekStarts(span.to, 12)[0]! }
}

const between = (iso: ISODate | null, span: { from: number; to: number }) => iso !== null && t(iso) >= span.from && t(iso) < span.to
/** Today's exact open counts from search, when no milestone narrows the question. */
const openCount = (s: Partial<ShapeMap>, ctx: MeasureContext, key: keyof NonNullable<ShapeMap['activity']>['open']) =>
  !ctx.scope?.milestone && s.activity ? s.activity.open[key] : null
const humanOpen = (s: Partial<ShapeMap>, ctx: MeasureContext) =>
  (s.pulls?.open ?? []).filter(p => !isBot(p.author) && (!ctx.scope?.milestone || p.milestone === ctx.scope.milestone))
const awaiting = (p: Pull) => !p.draft && p.firstHumanReviewAt === null && p.reviewDecision !== 'APPROVED'

function weekly<T>(items: readonly T[], at: (item: T) => number, now: number, f: (week: T[]) => number | null): number[] {
  return weekStarts(now, 12).map(start => f(items.filter(i => at(i) >= start && at(i) < start + WEEK)) ?? 0)
}

const minutes = (ms: number | null) => (ms === null ? null : Math.round((ms / 60_000) * 10) / 10)
const pct = (x: number | null) => (x === null ? null : x * 100)

/** The runs to read: the CI workflow's completed runs. */
const ci = (s: Partial<ShapeMap>): WorkflowRun[] => (s.workflowRuns ? ciRuns(s.workflowRuns) : [])
const runsIn = (runs: WorkflowRun[], span: { from: number; to: number }) => runs.filter(r => between(r.runStartedAt, span))
const flaky = (r: WorkflowRun) => r.runAttempt > 1 && r.conclusion === 'success'

function contributorCount(s: Partial<ShapeMap>, ctx: MeasureContext, span: { from: number; to: number }): number | null {
  if (ctx.scope?.release && s.commitsBetweenTags) return new Set(s.commitsBetweenTags.commits.filter(c => c.author && !isBot(c.author)).map(c => c.author!.login)).size
  if (s['stats.contributors']) {
    const active = s['stats.contributors'].authors.filter(a => !isBot(a.author) && a.weeks.some(w => t(w.weekStart) >= mondayOf(span.from) && t(w.weekStart) < span.to && w.commits > 0))
    return active.length
  }
  if (s.commits) return new Set(s.commits.commits.filter(c => c.author && !isBot(c.author) && between(c.date, span)).map(c => c.author!.login)).size
  return null
}

const IMPL: { [Id in MeasureId]: Impl<Id> } = {
  'open-prs': {
    needs: ['activity', 'pulls'],
    window: 'milestone',
    compute: (s, ctx) => {
      const exact = openCount(s, ctx, 'pulls')
      return exact !== null ? { value: exact } : s.pulls ? { value: humanOpen(s, ctx).length } : null
    },
  },
  'awaiting-review': {
    needs: ['activity', 'pulls'],
    window: 'milestone',
    compute: (s, ctx) => {
      const exact = openCount(s, ctx, 'awaitingReview')
      return exact !== null ? { value: exact } : s.pulls ? { value: humanOpen(s, ctx).filter(awaiting).length } : null
    },
  },
  'changes-requested': {
    needs: ['activity', 'pulls'],
    window: 'milestone',
    compute: (s, ctx) => {
      const exact = openCount(s, ctx, 'changesRequested')
      return exact !== null ? { value: exact } : s.pulls ? { value: humanOpen(s, ctx).filter(p => p.reviewDecision === 'CHANGES_REQUESTED').length } : null
    },
  },
  'failing-checks': {
    needs: ['checks'],
    window: '7d',
    compute: s => (s.checks ? { value: { count: s.checks.runs.filter(failed).length, total: s.checks.runs.length } } : null),
  },
  'milestone-issues-open': {
    needs: ['milestones'],
    window: 'milestone',
    compute: (s, ctx) => {
      if (!s.milestones) return null
      const m = ctx.scope?.milestone ? s.milestones.open.find(x => x.title === ctx.scope!.milestone) : nextMilestone(s.milestones)
      return m ? { value: { count: m.open, total: m.open + m.closed } } : null
    },
  },
  'prs-merged': {
    needs: ['pulls', 'activity'],
    window: '7d',
    compute: (s, _ctx, window) => {
      if (!s.pulls) return null
      const { span, coveredFrom } = covered(window, listCoverage(s.pulls))
      const value = s.pulls.merged.filter(p => !isBot(p.author) && between(p.mergedAt, span)).length
      return { value, coveredFrom, ...(s.activity ? { series12w: s.activity.weeks.map(w => w.pullsMerged) } : {}) }
    },
  },
  'review-wait-median': {
    needs: ['pulls'],
    window: '30d',
    compute: (s, _ctx, window) => {
      if (!s.pulls) return null
      const all = [...s.pulls.open, ...s.pulls.merged]
      const { span, coveredFrom, series } = covered(window, listCoverage(s.pulls))
      const value = median(reviewWaitHours(all, span.from, span.to))
      const weeks = series ? weekStarts(span.to, 12).map(start => median(reviewWaitHours(all, start, start + WEEK))) : []
      return value === null ? null : { value, coveredFrom, ...(series && weeks.every(w => w !== null) ? { series12w: weeks as number[] } : {}) }
    },
  },
  'review-wait-p90': {
    needs: ['pulls'],
    window: '30d',
    compute: (s, _ctx, window) => {
      if (!s.pulls) return null
      const { span, coveredFrom } = covered(window, listCoverage(s.pulls))
      const value = percentile(reviewWaitHours([...s.pulls.open, ...s.pulls.merged], span.from, span.to), 90)
      return value === null ? null : { value, coveredFrom }
    },
  },
  'time-to-close-median': {
    needs: ['pulls', 'issues'],
    window: '30d',
    compute: (s, _ctx, window) => {
      if (!s.pulls || !s.issues) return null
      const { span, coveredFrom } = covered(window, listCoverage(s.pulls, s.issues))
      const value = median(closeDays(s.pulls.merged, s.issues.closed, span.from, span.to))
      return value === null ? null : { value, coveredFrom }
    },
  },
  'closure-ratio': {
    needs: ['activity'],
    window: '12w',
    compute: s => {
      if (!s.activity) return null
      const r = closureRatio(s.activity)
      return r.total === null ? null : { value: r.total, series12w: r.weeks.map(w => w.ratio ?? 0) }
    },
  },
  'ci-p50': {
    needs: ['workflowRuns'],
    window: '7d',
    compute: (s, _ctx, span) => {
      const runs = timedRuns(ci(s))
      const value = minutes(median(runsIn(runs, span).map(r => r.durationMs)))
      return value === null ? null : { value, series12w: weekly(runs, r => t(r.runStartedAt), span.to, w => minutes(median(w.map(r => r.durationMs)))) }
    },
  },
  'ci-p90': {
    needs: ['workflowRuns'],
    window: '7d',
    compute: (s, _ctx, span) => {
      const value = minutes(percentile(runsIn(timedRuns(ci(s)), span).map(r => r.durationMs), 90))
      return value === null ? null : { value }
    },
  },
  'failing-check-rate': {
    needs: ['workflowRuns'],
    window: '30d',
    compute: (s, _ctx, span) => {
      const runs = ci(s)
      const rate = (w: WorkflowRun[]) => (w.length ? pct(w.filter(failed).length / w.length) : null)
      const value = rate(runsIn(runs, span))
      return value === null ? null : { value, series12w: weekly(runs, r => t(r.runStartedAt), span.to, rate) }
    },
  },
  'flaky-rate': {
    needs: ['workflowRuns'],
    window: '30d',
    compute: (s, _ctx, span) => {
      const runs = runsIn(ci(s), span)
      return runs.length ? { value: pct(runs.filter(flaky).length / runs.length)! } : null
    },
  },
  'slowest-job': { needs: ['slowestJob'], window: '30d', compute: s => (s.slowestJob ? { value: minutes(s.slowestJob.durationMs)! } : null) },
  'failing-since': {
    needs: ['workflowRuns'],
    window: '30d',
    compute: s => {
      const runs = [...ci(s)].sort((a, b) => t(b.runStartedAt) - t(a.runStartedAt))
      if (!runs.length) return null
      const streak = runs.findIndex(r => !failed(r))
      return { value: streak === -1 ? runs.length : streak }
    },
  },
  'pr-size': {
    needs: ['biggestOpenPr'],
    window: 'milestone',
    compute: (s, ctx) => {
      const pull = ctx.scope?.pr ? [...(s.pulls?.open ?? []), ...(s.pulls?.merged ?? [])].find(p => p.number === ctx.scope!.pr) : s.biggestOpenPr?.pull
      return pull ? { value: prSize(pull) } : null
    },
  },
  contributors: {
    needs: ['stats.contributors'],
    window: '90d',
    compute: (s, ctx, span) => {
      const value = contributorCount(s, ctx, span)
      return value === null ? null : { value }
    },
  },
  'first-time-contributors': {
    needs: ['pulls', 'stats.contributors'],
    window: '90d',
    compute: (s, _ctx, window) => {
      if (!s.pulls || !s['stats.contributors']) return null
      const { span, coveredFrom } = covered(window, listCoverage(s.pulls))
      // GitHub's association is read today, so a first merge already shows as CONTRIBUTOR; prior commits are the test instead.
      const before = new Set(
        s['stats.contributors'].authors.filter(a => a.weeks.some(w => t(w.weekStart) < mondayOf(span.from) && w.commits > 0)).map(a => a.author.login),
      )
      const firsts = new Set(s.pulls.merged.filter(p => !isBot(p.author) && between(p.mergedAt, span) && !before.has(p.author.login)).map(p => p.author.login))
      return { value: firsts.size, coveredFrom }
    },
  },
  'bus-factor': {
    needs: ['contributorShare'],
    window: '90d',
    compute: s => (s.contributorShare ? { value: busFactor(s.contributorShare.commits).factor } : null),
  },
  'core-share': {
    needs: ['pulls'],
    window: '90d',
    compute: (s, _ctx, window) => {
      if (!s.pulls) return null
      const { span, coveredFrom, series } = covered(window, listCoverage(s.pulls))
      const merged = s.pulls.merged.filter(p => !isBot(p.author) && between(p.mergedAt, span))
      const total = merged.length ? merged.filter(p => CORE_ASSOCIATIONS.has(p.authorAssociation)).length / merged.length : null
      const weeks = series ? coreShare({ merged: s.pulls.merged, weekStarts: weekStarts(span.to, 12).map(ms => new Date(ms).toISOString()) }).weeks : []
      return total === null ? null : { value: pct(total)!, coveredFrom, ...(series && weeks.every(w => w !== null) ? { series12w: weeks.map(w => pct(w)!) } : {}) }
    },
  },
  'community-share': {
    needs: ['pulls'],
    window: '90d',
    compute: (s, ctx, span) => {
      const core = IMPL['core-share'].compute(s, ctx, span)
      return core ? { value: 100 - core.value, coveredFrom: core.coveredFrom, ...(core.series12w ? { series12w: core.series12w.map(v => 100 - v) } : {}) } : null
    },
  },
  'stale-issues': {
    needs: ['activity', 'staleIssues'],
    window: '30d',
    compute: s => (s.activity ? { value: s.activity.open.staleIssues } : s.staleIssues ? { value: s.staleIssues.issues.length } : null),
  },
  'good-first-issues': {
    needs: ['activity', 'goodFirstIssues'],
    window: '30d',
    compute: s => (s.activity ? { value: s.activity.open.goodFirstIssues } : s.goodFirstIssues ? { value: s.goodFirstIssues.issues.length } : null),
  },
  stars: { needs: ['repo'], window: '30d', compute: s => (s.repo ? { value: s.repo.stars } : null) },
  commits: {
    needs: ['stats.commitActivity'],
    window: '30d',
    compute: (s, ctx, span) => {
      if (ctx.scope?.release && s.commitsBetweenTags) return { value: s.commitsBetweenTags.commits.length }
      if (ctx.scope?.author && s.commits) return { value: s.commits.commits.filter(c => c.author?.login === ctx.scope!.author && between(c.date, span)).length }
      if (s['stats.commitActivity']) {
        const weeks = s['stats.commitActivity'].weeks
        const value = weeks.filter(w => t(w.weekStart) >= mondayOf(span.from)).reduce((n, w) => n + w.total, 0)
        return { value, series12w: weeks.slice(-12).map(w => w.total) }
      }
      return s.commits ? { value: s.commits.commits.filter(c => between(c.date, span)).length } : null
    },
  },
  'files-changed': {
    needs: ['prFiles'],
    window: 'milestone',
    compute: (s, ctx) => {
      if (ctx.scope?.release && s.commitsBetweenTags) return { value: s.commitsBetweenTags.totals.changedFiles }
      return s.prFiles ? { value: s.prFiles.files.length } : null
    },
  },
  'busiest-hour': { needs: ['busiestHour'], window: '12w', compute: s => (s.busiestHour ? { value: s.busiestHour.hour } : null) },
  'quietest-day': { needs: ['quietestDay'], window: '12w', compute: s => (s.quietestDay ? { value: s.quietestDay.name } : null) },
  'milestone-closes': {
    needs: ['milestones'],
    window: 'milestone',
    compute: s => {
      const m = s.milestones ? nextMilestone(s.milestones) : null
      return m?.dueOn ? { value: m.dueOn } : null
    },
  },
}

/** What a measure reads changes with its scope: commits between releases come from the compare, a person's from the commit list. */
const SCOPED_NEEDS: Partial<Record<MeasureId, (scope: MeasureScope) => ShapeName[] | undefined>> = {
  commits: scope => (scope.release ? ['commitsBetweenTags'] : scope.author ? ['commits'] : undefined),
  contributors: scope => (scope.release ? ['commitsBetweenTags'] : undefined),
  'files-changed': scope => (scope.release ? ['commitsBetweenTags'] : undefined),
  'pr-size': scope => (scope.pr ? ['pulls'] : ['biggestOpenPr']),
}

/** The shapes a measure reads, so the context builder fetches them and a test can check each template asks for them. */
export function measureNeeds(id: MeasureId, scope: MeasureScope = {}): readonly ShapeName[] {
  return SCOPED_NEEDS[id]?.(scope) ?? IMPL[id].needs
}

export const DEFAULT_WINDOW: Readonly<Record<MeasureId, MeasureWindow>> = Object.fromEntries(
  Object.entries(IMPL).map(([id, impl]) => [id, impl.window]),
) as Record<MeasureId, MeasureWindow>

/** Null when the shapes it needs hold nothing to measure: the Metric shows its empty state. */
export function computeMeasure<Id extends MeasureId>(id: Id, ctx: MeasureContext, window: MeasureWindow = IMPL[id].window): MeasureResult<Id> | null {
  const impl = IMPL[id] as Impl<Id>
  const result = impl.compute(ctx.shapes, ctx, windowSpan(window, ctx.now))
  if (!result) return null
  const unit = MEASURES[id].unit as MeasureUnit<Id>
  const read = measureNeeds(id, ctx.scope).map(n => ctx.cachedAt[n]).filter((x): x is string => x !== undefined)
  return {
    id,
    value: result.value,
    unit,
    formatted: formatValue(unit, result.value as never),
    ...(result.series12w ? { series12w: result.series12w } : {}),
    ...(result.coveredFrom !== undefined ? { coveredFrom: new Date(result.coveredFrom).toISOString() } : {}),
    cachedAt: read.length ? read.reduce((a, b) => (t(a) <= t(b) ? a : b)) : new Date(ctx.now).toISOString(),
  }
}

export { mainWorkflow }
