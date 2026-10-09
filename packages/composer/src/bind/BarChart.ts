import {
  ciRuns,
  DEFAULT_WINDOW,
  failed,
  isBot,
  listCoverage,
  MEASURES,
  median,
  mondayOf,
  percentile,
  reviewWaitHours,
  timedRuns,
  windowSpan,
  type Issue,
  type MeasureId,
  type MeasureWindow,
  type Pull,
  type ShapeName,
  type WorkflowRun,
} from '@genui-github/data'
import { validateNumbers } from '@genui-github/ui'
import { bound, empty, unavailable, type Binder, type DataContext } from './types'
import {
  barFacts,
  formatChartValue,
  lower,
  missingCause,
  round1,
  WINDOW_WORDS,
  type ChartUnit,
} from './group-b-ui'
import { BarChart } from '@genui-github/ui/schemas'

type BarBy = BarChart.BarBy
type BarDatum = BarChart.BarDatum
type BarChartModel = BarChart.BarChartModelProps
type BarChartBound = BarChart.BarChartProps
const { BY_WORDS, MAX_BARS } = BarChart

const COMPONENT = 'BarChart'
const t = (iso: string) => Date.parse(iso)
const NO_LABEL = 'No label'

type Span = { from: number; to: number }

interface Grouped {
  bars: BarDatum[]
  /** How many items the bars were read from, and the exact count when the list is a capped sample of it. */
  listed?: number
  exact?: number
}

interface Grouping {
  needs: ShapeName[]
  unit: ChartUnit
  /** What a count is of, in words: "stale issues". */
  noun: string
  /** Set for a measure read over a window; the others are today's lists. */
  windowed?: boolean
  /** The meta line when the model wrote none and nothing narrows it. */
  meta?: string
  by: Partial<Record<BarBy, (ctx: DataContext, span: Span) => Grouped>>
}

/** One bar per key, counting every item under each of its keys. */
function countBy<T>(items: readonly T[], keys: (item: T) => string[]): BarDatum[] {
  const counts = new Map<string, number>()
  for (const item of items) for (const k of new Set(keys(item))) counts.set(k, (counts.get(k) ?? 0) + 1)
  return [...counts].map(([key, value]) => ({ key, label: key, value }))
}

/** One bar per key, the key's items reduced to one figure; a group the reducer cannot read has no bar. */
function reduceBy<T>(items: readonly T[], keys: (item: T) => string[], reduce: (group: T[]) => number | null): BarDatum[] {
  const groups = new Map<string, T[]>()
  for (const item of items) for (const k of new Set(keys(item))) groups.set(k, [...(groups.get(k) ?? []), item])
  return [...groups].flatMap(([key, group]) => {
    const value = reduce(group)
    return value === null ? [] : [{ key, label: key, value }]
  })
}

const labelsOf = (item: { labels: string[] }) => (item.labels.length ? item.labels : [NO_LABEL])
const authorOf = (item: { author: { login: string } }) => [item.author.login]
const awaiting = (p: Pull) => !p.draft && p.firstHumanReviewAt === null && p.reviewDecision !== 'APPROVED'
const between = (iso: string | null, span: Span) => iso !== null && t(iso) >= span.from && t(iso) < span.to

function listGrouping(noun: string, needs: ShapeName[], items: (ctx: DataContext) => { list: readonly (Issue | Pull)[]; exact?: number }, extra: Partial<Grouping> = {}): Grouping {
  const read = (keys: (item: Issue | Pull) => string[]) => (ctx: DataContext) => {
    const { list, exact } = items(ctx)
    return { bars: countBy(list, keys), listed: list.length, ...(exact !== undefined ? { exact } : {}) }
  }
  return { needs, unit: 'count', noun, by: { label: read(labelsOf), author: read(authorOf) }, ...extra }
}

const humanOpen = (ctx: DataContext) => ctx.shapes.pulls!.open.filter(p => !isBot(p.author))

function runGrouping(unit: ChartUnit, reduce: (runs: WorkflowRun[]) => number | null): Grouping {
  return {
    needs: ['workflowRuns'],
    unit,
    noun: 'CI runs',
    windowed: true,
    by: {
      workflow: (ctx, span) => {
        const shape = ctx.shapes.workflowRuns!
        const workflows = [...new Set(shape.runs.map(r => r.workflowName))]
        const bars = workflows.flatMap(name => {
          const value = reduce(ciRuns(shape, name).filter(r => between(r.runStartedAt, span)))
          return value === null ? [] : [{ key: name, label: name, value }]
        })
        return { bars }
      },
    },
  }
}

const minutes = (ms: number | null) => (ms === null ? null : round1(ms / 60_000))
const rate = (runs: WorkflowRun[], f: (r: WorkflowRun) => boolean) => (runs.length ? round1((runs.filter(f).length / runs.length) * 100) : null)

const GROUPINGS: Partial<Record<MeasureId, Grouping>> = {
  'stale-issues': listGrouping('stale issues', ['staleIssues'], ctx => ({ list: ctx.shapes.staleIssues!.issues, exact: ctx.shapes.activity?.open.staleIssues }), {
    meta: 'no activity in 30 days',
  }),
  'good-first-issues': listGrouping('good first issues', ['goodFirstIssues'], ctx => ({ list: ctx.shapes.goodFirstIssues!.issues, exact: ctx.shapes.activity?.open.goodFirstIssues })),
  'open-prs': listGrouping('open pull requests', ['pulls'], ctx => ({ list: humanOpen(ctx), exact: ctx.shapes.activity?.open.pulls })),
  'awaiting-review': listGrouping('pull requests awaiting review', ['pulls'], ctx => ({ list: humanOpen(ctx).filter(awaiting), exact: ctx.shapes.activity?.open.awaitingReview })),
  'changes-requested': listGrouping('pull requests with changes requested', ['pulls'], ctx => ({
    list: humanOpen(ctx).filter(p => p.reviewDecision === 'CHANGES_REQUESTED'),
    exact: ctx.shapes.activity?.open.changesRequested,
  })),
  'prs-merged': {
    needs: ['pulls'],
    unit: 'count',
    noun: 'pull requests merged',
    windowed: true,
    by: {
      label: (ctx, span) => ({ bars: countBy(mergedIn(ctx, span), labelsOf) }),
      author: (ctx, span) => ({ bars: countBy(mergedIn(ctx, span), authorOf) }),
    },
  },
  commits: {
    needs: ['stats.contributors'],
    unit: 'count',
    noun: 'commits',
    windowed: true,
    by: {
      author: (ctx, span) => ({
        bars: ctx.shapes['stats.contributors']!.authors.flatMap(a => {
          if (isBot(a.author)) return []
          // As the commits measure reads them: whole weeks from the one holding the window's start.
          const value = a.weeks.filter(w => t(w.weekStart) >= mondayOf(span.from) && t(w.weekStart) < span.to).reduce((n, w) => n + w.commits, 0)
          return value > 0 ? [{ key: a.author.login, label: a.author.login, value }] : []
        }),
      }),
    },
  },
  'review-wait-median': {
    needs: ['pulls'],
    unit: 'h',
    noun: 'reviewed pull requests',
    windowed: true,
    by: {
      label: (ctx, span) => ({ bars: reduceBy(reviewPool(ctx), labelsOf, g => medianWait(g, span)) }),
      author: (ctx, span) => ({ bars: reduceBy(reviewPool(ctx), authorOf, g => medianWait(g, span)) }),
    },
  },
  'ci-p50': runGrouping('min', runs => minutes(median(timedRuns(runs).map(r => r.durationMs)))),
  'ci-p90': runGrouping('min', runs => minutes(percentile(timedRuns(runs).map(r => r.durationMs), 90))),
  'failing-check-rate': runGrouping('percent', runs => rate(runs, failed)),
  'flaky-rate': runGrouping('percent', runs => rate(runs, r => r.runAttempt > 1 && r.conclusion === 'success')),
}

/** The merged list is capped; a window reaching past its oldest merge is cut to it. */
const coveredSpan = (ctx: DataContext, span: Span): Span => ({ from: Math.max(span.from, listCoverage(ctx.shapes.pulls)), to: span.to })
const mergedIn = (ctx: DataContext, span: Span) => ctx.shapes.pulls!.merged.filter(p => !isBot(p.author) && between(p.mergedAt, coveredSpan(ctx, span)))
const reviewPool = (ctx: DataContext) => [...ctx.shapes.pulls!.open, ...ctx.shapes.pulls!.merged]
function medianWait(pulls: Pull[], span: Span): number | null {
  const m = median(reviewWaitHours(pulls, span.from, span.to))
  return m === null ? null : round1(m)
}

type Bars = { kind: 'bars'; bound: BarChartBound; grouping: Grouping; window: MeasureWindow } | { kind: 'error'; bound: BarChartBound; failed: string; cause: string }

function group(ctx: DataContext, props: BarChartModel): Bars {
  const grouping = GROUPINGS[props.measure]
  const base: BarChartBound = { title: props.title, ...(props.meta ? { meta: props.meta } : {}), by: props.by, unit: grouping?.unit ?? 'count', bars: [], finding: props.finding }
  const label = lower(MEASURES[props.measure].label)
  const read = grouping?.by[props.by]
  if (!grouping || !read) return { kind: 'error', bound: base, failed: `Couldn't group ${label} by ${BY_WORDS[props.by].column.toLowerCase()}`, cause: `The data has no ${BY_WORDS[props.by].column.toLowerCase()} for it` }
  const missing = grouping.needs.filter(n => !ctx.shapes[n])
  if (missing.length) return { kind: 'error', bound: base, failed: `Couldn't load ${grouping.noun}`, cause: missingCause(ctx, missing) }

  const window = DEFAULT_WINDOW[props.measure]
  const span = windowSpan(window, ctx.now)
  const grouped = read(ctx, span)
  const bars = grouped.bars.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)).slice(0, MAX_BARS)
  const sampled = grouped.exact !== undefined && grouped.listed !== undefined && grouped.listed < grouped.exact
  // A capped list is a sample of the whole; the meta says so whatever the model wrote.
  const meta = sampled
    ? `${grouped.listed} listed of ${grouped.exact}`
    : (props.meta ?? grouping.meta ?? (grouping.windowed ? WINDOW_WORDS[window] : undefined))
  return { kind: 'bars', grouping, window, bound: { ...base, ...(meta ? { meta } : {}), bars } }
}

/** A plain sentence about the largest bars whose every number passes BarChart's own check. */
export function systemFinding(ctx: DataContext, props: BarChartModel): string {
  const grouped = group(ctx, props)
  if (grouped.kind === 'error') return `${MEASURES[props.measure].label} by ${BY_WORDS[props.by].column.toLowerCase()}.`
  const { bars, unit } = grouped.bound
  const [top, next] = bars
  if (!top) return `No ${grouped.grouping.noun} to compare.`
  const count = unit === 'count'
  const say = (v: number) => (count ? `${formatChartValue(v, unit)} ${grouped.grouping.noun}` : `${formatChartValue(v, unit)}${unit === 'percent' ? '%' : ` ${unit}`}`)
  const plain = (v: number) => (count ? formatChartValue(v, unit) : say(v))
  const sentence = !next
    ? `${top.label} is the only ${BY_WORDS[props.by].plural.slice(0, -1)}, at ${say(top.value)}.`
    : next.value === top.value
      ? `${top.label} and ${next.label} tie at ${say(top.value)}.`
      : `${top.label} leads ${count ? 'with' : 'at'} ${say(top.value)}, ahead of ${next.label} at ${plain(next.value)}.`
  // A label with digits in it ("v15", "node 18") would read as a figure; the sentence then names no label.
  const fits = sentence.length <= 120 && validateNumbers(sentence, barFacts(bars.map(b => b.value))).ok
  return fits ? sentence : `The largest bar is ${say(top.value)}.`
}

export const bindBarChart: Binder<BarChartModel> = (ctx, props, extras) => {
  const grouped = group(ctx, props)
  if (grouped.kind === 'error') return unavailable(COMPONENT, props, grouped.bound, { failed: grouped.failed, cause: grouped.cause }, extras)
  if (!grouped.bound.bars.length) {
    const { grouping, window } = grouped
    const none = `No ${grouping.noun}${grouping.windowed ? ` in the ${WINDOW_WORDS[window]}` : ''}`
    return empty(
      COMPONENT,
      props,
      // No stale issue is good news; no CI run in the window is only an absence.
      { ...grouped.bound, emptyTone: !grouping.windowed && MEASURES[props.measure].better === 'lower' ? 'good' : 'neutral', empty: none },
      extras,
    )
  }
  return bound(COMPONENT, props, grouped.bound, extras)
}
