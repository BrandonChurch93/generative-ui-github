import {
  ciRuns,
  closeDays,
  CORE_ASSOCIATIONS,
  failed,
  isBot,
  listCoverage,
  MEASURES,
  median,
  mondayOf,
  percentile,
  reviewWaitHours,
  timedRuns,
  weekStarts,
  windowSpan,
  type MeasureId,
  type MonthCompareShape,
  type ShapeName,
  type WorkflowRun,
} from '@genui-github/data'
import { bound, empty, unavailable, type Binder, type DataContext } from './types'
import {
  capital,
  lower,
  missingCause,
  round1,
} from './group-b-ui'
import { validateNumbers } from '@genui-github/ui'
import { Comparison, ComparisonReading } from '@genui-github/ui/schemas'

type ComparisonModel = Comparison.ComparisonModelProps
type ComparisonBound = Comparison.ComparisonProps
type ComparisonPair = Comparison.ComparisonPair
type ComparisonPeriods = Comparison.ComparisonPeriods
type PairUnit = Comparison.PairUnit
const COMPARISON_EMPTY = Comparison.COMPARISON_WORDS.empty

const COMPONENT = 'Comparison'
const DAY = 86_400_000
const t = (iso: string) => Date.parse(iso)
const RUN_WEEKS = 12

type Span = { from: number; to: number }

interface Family {
  needs: ShapeName[]
  /** Null when the data does not reach back over the span, or holds nothing to measure in it. */
  value(ctx: DataContext, span: Span): number | null
  /** The footer's words for what the two values were read from. */
  source(ctx: DataContext, spans: [Span, Span]): string | null
}

const between = (iso: string | null, span: Span) => iso !== null && t(iso) >= span.from && t(iso) < span.to
const both = (spans: [Span, Span]): Span => ({ from: spans[1].from, to: spans[0].to })

function runFamily(reduce: (runs: WorkflowRun[]) => number | null): Family {
  const runs = (ctx: DataContext, span: Span) => ciRuns(ctx.shapes.workflowRuns!).filter(r => between(r.runStartedAt, span))
  return {
    needs: ['workflowRuns'],
    value: (ctx, span) => (span.from < weekStarts(ctx.now, RUN_WEEKS)[0]! ? null : reduce(runs(ctx, span))),
    source: (ctx, spans) => {
      const n = runs(ctx, both(spans)).length
      const workflow = ciRuns(ctx.shapes.workflowRuns!)[0]?.workflowName
      return n && workflow ? `${n.toLocaleString('en-US')} runs of ${workflow}` : null
    },
  }
}

const minutes = (ms: number | null) => (ms === null ? null : ms / 60_000)
const share = (runs: WorkflowRun[], f: (r: WorkflowRun) => boolean) => (runs.length ? (runs.filter(f).length / runs.length) * 100 : null)

/** The pull and issue lists are capped; a span that starts before they reach has no value. */
const listed = (ctx: DataContext, span: Span, withIssues = false) => span.from >= listCoverage(ctx.shapes.pulls, withIssues ? ctx.shapes.issues : undefined)
const humanMerged = (ctx: DataContext, span: Span) => ctx.shapes.pulls!.merged.filter(p => !isBot(p.author) && between(p.mergedAt, span))
const waits = (ctx: DataContext, span: Span) => reviewWaitHours([...ctx.shapes.pulls!.open, ...ctx.shapes.pulls!.merged], span.from, span.to)

function coreShare(ctx: DataContext, span: Span): number | null {
  if (!listed(ctx, span)) return null
  const merged = humanMerged(ctx, span)
  return merged.length ? (merged.filter(p => CORE_ASSOCIATIONS.has(p.authorAssociation)).length / merged.length) * 100 : null
}

function commitDays(ctx: DataContext): { first: number; days: Map<number, number> } {
  const days = new Map<number, number>()
  const weeks = ctx.shapes['stats.commitActivity']!.weeks
  for (const w of weeks) w.days.forEach((n, i) => days.set(t(w.weekStart) + i * DAY, n))
  return { first: weeks.length ? t(weeks[0]!.weekStart) : Infinity, days }
}

const FAMILIES: Partial<Record<MeasureId, Family>> = {
  'ci-p50': runFamily(runs => minutes(median(timedRuns(runs).map(r => r.durationMs)))),
  'ci-p90': runFamily(runs => minutes(percentile(timedRuns(runs).map(r => r.durationMs), 90))),
  'failing-check-rate': runFamily(runs => share(runs, failed)),
  'flaky-rate': runFamily(runs => share(runs, r => r.runAttempt > 1 && r.conclusion === 'success')),
  'prs-merged': {
    needs: ['pulls'],
    value: (ctx, span) => {
      // Search counts are exact; the merged list is a capped sample, read only where it reaches.
      const week = ctx.shapes.activity?.weeks.find(w => t(w.weekStart) === span.from && span.from === mondayOf(span.from))
      if (week && span.to - span.from <= 7 * DAY) return week.pullsMerged
      return listed(ctx, span) ? humanMerged(ctx, span).length : null
    },
    source: () => null,
  },
  'review-wait-median': {
    needs: ['pulls'],
    value: (ctx, span) => (listed(ctx, span) ? median(waits(ctx, span)) : null),
    source: (ctx, spans) => reviewed(ctx, spans),
  },
  'review-wait-p90': {
    needs: ['pulls'],
    value: (ctx, span) => (listed(ctx, span) ? percentile(waits(ctx, span), 90) : null),
    source: (ctx, spans) => reviewed(ctx, spans),
  },
  'time-to-close-median': {
    needs: ['pulls', 'issues'],
    value: (ctx, span) => (listed(ctx, span, true) ? median(closeDays(ctx.shapes.pulls!.merged, ctx.shapes.issues!.closed, span.from, span.to)) : null),
    source: (ctx, spans) => {
      const n = spans.filter(s => listed(ctx, s, true)).reduce((sum, s) => sum + closeDays(ctx.shapes.pulls!.merged, ctx.shapes.issues!.closed, s.from, s.to).length, 0)
      return n ? `${n.toLocaleString('en-US')} closed issues and PRs` : null
    },
  },
  'core-share': { needs: ['pulls'], value: coreShare, source: (ctx, spans) => mergedSource(ctx, spans) },
  'community-share': {
    needs: ['pulls'],
    value: (ctx, span) => {
      const core = coreShare(ctx, span)
      return core === null ? null : 100 - core
    },
    source: (ctx, spans) => mergedSource(ctx, spans),
  },
  commits: {
    needs: ['stats.commitActivity'],
    value: (ctx, span) => {
      const { first, days } = commitDays(ctx)
      if (span.from < first) return null
      // Whole days: the day holding the span's start belongs to it, and the current span runs through today.
      const start = span.from - (span.from % DAY)
      const end = span.to >= ctx.now ? Infinity : span.to - (span.to % DAY)
      let n = 0
      for (const [day, count] of days) if (day >= start && day < end) n += count
      return n
    },
    source: () => null,
  },
  contributors: {
    needs: ['stats.contributors'],
    value: (ctx, span) => {
      const authors = ctx.shapes['stats.contributors']!.authors
      const first = Math.min(...authors.flatMap(a => a.weeks.map(w => t(w.weekStart))))
      if (span.from < first) return null
      return authors.filter(a => !isBot(a.author) && a.weeks.some(w => t(w.weekStart) >= mondayOf(span.from) && t(w.weekStart) < span.to && w.commits > 0)).length
    },
    source: () => "GitHub's contributor stats",
  },
}

function reviewed(ctx: DataContext, spans: [Span, Span]): string | null {
  const n = spans.filter(s => listed(ctx, s)).reduce((sum, s) => sum + waits(ctx, s).length, 0)
  return n ? `${n.toLocaleString('en-US')} reviewed PRs` : null
}

function mergedSource(ctx: DataContext, spans: [Span, Span]): string | null {
  const n = spans.filter(s => listed(ctx, s)).reduce((sum, s) => sum + humanMerged(ctx, s).length, 0)
  return n ? `${n.toLocaleString('en-US')} merged PRs` : null
}

type MonthKey = keyof MonthCompareShape['current']['values']
const MONTH_KEYS: readonly MeasureId[] = ['prs-merged', 'review-wait-median', 'failing-check-rate', 'time-to-close-median'] satisfies MonthKey[]
const isMonthKey = (id: MeasureId): id is MonthKey => MONTH_KEYS.includes(id)

const monthFormat = (month: 'long' | 'short') => new Intl.DateTimeFormat('en-US', { month, timeZone: 'UTC' })

function periodsFor(window: ComparisonModel['window'], current: Span): ComparisonPeriods {
  if (window === 'month') {
    const [now, before] = [new Date(current.from), new Date(current.from - 1)]
    return {
      current: `${monthFormat('long').format(now)} so far`,
      previous: monthFormat('long').format(before),
      currentShort: monthFormat('short').format(now),
      previousShort: monthFormat('short').format(before),
    }
  }
  if (window === 'week') return { current: 'this week so far', previous: 'last week', currentShort: 'this wk', previousShort: 'last wk' }
  return { current: 'last 30 days', previous: '30 before', currentShort: '30d', previousShort: 'prior' }
}

const UNIT: Record<string, PairUnit> = { count: 'count', 'count-of-total': 'count', runs: 'count', h: 'h', d: 'd', min: 'min', percent: 'percent', ratio: 'ratio' }
const roundFor = (v: number, unit: PairUnit) => (unit === 'count' ? Math.round(v) : round1(v))

type Compared = { kind: 'pairs'; bound: ComparisonBound } | { kind: 'error'; bound: ComparisonBound; failed: string; cause: string }

function compare(ctx: DataContext, props: ComparisonModel): Compared {
  const current = props.window === 'milestone' ? { from: ctx.now, to: ctx.now } : windowSpan(props.window, ctx.now)
  const previous: Span = { from: windowSpan(props.window === 'milestone' ? '30d' : props.window, current.from - 1).from, to: current.from }
  const periods = props.window === 'milestone' ? { current: 'this milestone', previous: 'the last one', currentShort: 'now', previousShort: 'prior' } : periodsFor(props.window, current)
  const base: ComparisonBound = { title: props.title, window: props.window, pairs: [], finding: props.finding, periods, source: 'from no data', ...(props.emptyTone ? { emptyTone: props.emptyTone } : {}) }
  if (props.window === 'milestone') return { kind: 'error', bound: base, failed: "Couldn't compare milestones", cause: 'GitHub keeps no record of what the last milestone measured' }

  const month = props.window === 'month' ? ctx.shapes.monthCompare : undefined
  const pairs: ComparisonPair[] = []
  const parts: string[] = []
  const dropped: string[] = []
  const missing = new Set<ShapeName>()
  for (const p of props.pairs) {
    const def = MEASURES[p.measure]
    const name = def.label.slice(0, 24)
    const family = FAMILIES[p.measure]
    if (!family) {
      dropped.push(`${lower(name)} has no history to compare`)
      continue
    }
    const absent = family.needs.filter(n => !ctx.shapes[n])
    if (absent.length && !(month && isMonthKey(p.measure))) {
      absent.forEach(n => missing.add(n))
      dropped.push(`${lower(name)} is not in this answer's data`)
      continue
    }
    const [now, before] =
      month && isMonthKey(p.measure) ? [month.current.values[p.measure], month.previous.values[p.measure]] : [family.value(ctx, current), family.value(ctx, previous)]
    if (now === null || before === null) {
      const gap = now === null && before === null ? 'either window' : now === null ? periods.current : periods.previous
      dropped.push(`${lower(name)} unknown for ${gap}`)
      continue
    }
    const unit = UNIT[def.unit] ?? 'count'
    pairs.push({
      measure: p.measure,
      direction: p.direction,
      ...(p.notable !== undefined ? { notable: p.notable } : {}),
      ...(p.ask ? { ask: p.ask } : {}),
      name,
      meta: def.what,
      unit,
      current: roundFor(now, unit),
      previous: roundFor(before, unit),
    })
    const total = (roundFor(now, unit) + roundFor(before, unit)).toLocaleString('en-US')
    const part = p.measure === 'prs-merged' ? `${total} merged PRs` : p.measure === 'commits' ? `${total} commits` : family.source(ctx, [current, previous])
    if (part && !parts.includes(part)) parts.push(part)
  }

  if (!pairs.length && missing.size) return { kind: 'error', bound: base, failed: "Couldn't load the comparison", cause: missingCause(ctx, [...missing]) }
  // The footer always says what was read, and names any pair left out so a missing row is never silent.
  const source = [parts.length ? `from ${parts.join(' · ')}` : 'from no data in either window', ...dropped].join(' · ')
  return { kind: 'pairs', bound: { ...base, pairs, source, ...(dropped.length && !pairs.length ? { emptyMeta: capital(dropped.join(' · ')) } : {}) } }
}

const UNIT_AFTER: Record<PairUnit, string> = { count: '', h: ' h', d: ' days', min: ' min', percent: '%', ratio: '×' }

function pairWords(pair: ComparisonPair, lead: boolean): string {
  const name = lead ? pair.name : lower(pair.name)
  const say = (v: number) => `${ComparisonReading.formatPairValue(v, pair.unit)}${UNIT_AFTER[pair.unit]}`
  if (pair.current === pair.previous) return `${name} held at ${say(pair.current)}`
  return `${name} ${pair.current > pair.previous ? 'rose' : 'fell'} from ${pair.unit === 'percent' ? say(pair.previous) : ComparisonReading.formatPairValue(pair.previous, pair.unit)} to ${say(pair.current)}`
}

/** A plain sentence about the first one or two pairs whose every number passes Comparison's own check. */
export function systemFinding(ctx: DataContext, props: ComparisonModel): string {
  const compared = compare(ctx, props)
  const [a, b] = compared.bound.pairs
  if (!a) return `${COMPARISON_EMPTY}.`
  const one = `${pairWords(a, true)}.`
  const two = b ? `${pairWords(a, true)}; ${pairWords(b, false)}.` : one
  const facts = ComparisonReading.comparisonFacts(compared.bound)
  const passes = (s: string) => s.length <= 90 && validateNumbers(s, facts).ok
  return passes(two) ? two : passes(one) ? one : `${a.name} ${a.current > a.previous ? 'rose' : a.current < a.previous ? 'fell' : 'held'}.`
}

export const bindComparison: Binder<ComparisonModel> = (ctx, props, extras) => {
  const compared = compare(ctx, props)
  if (compared.kind === 'error') return unavailable(COMPONENT, props, compared.bound, { failed: compared.failed, cause: compared.cause }, extras)
  if (!compared.bound.pairs.length) {
    return empty(COMPONENT, props, { ...compared.bound, emptyTone: props.emptyTone ?? 'neutral', empty: COMPARISON_EMPTY }, extras)
  }
  return bound(COMPONENT, props, compared.bound, extras)
}

