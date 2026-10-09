import {
  ciDurationByWeek,
  ciRuns,
  closeDays,
  closureRatio,
  CORE_ASSOCIATIONS,
  failureRateByWeek,
  isBot,
  listCoverage,
  MEASURES,
  median,
  percentile,
  reviewWaitHours,
  weekStarts,
  type MeasureId,
  type ShapeName,
  type WorkflowRunsShape,
} from '@genui-github/data'
import { bound, empty, unavailable, type Binder, type DataContext } from './types'
import {
  dateWords,
  formatChartValue,
  lower,
  missingCause,
  round1,
  WINDOW_WORDS,
  type ChartUnit,
} from './group-b-ui'
import type { LineChart } from '@genui-github/ui/schemas'

type LineChartModel = LineChart.LineChartModelProps
type LineChartBound = LineChart.LineChartProps

const COMPONENT = 'LineChart'
const DAY = 86_400_000
const WEEK = 7 * DAY
const t = (iso: string) => Date.parse(iso)
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

type Scope = Record<string, string | number>
interface Points {
  points: (number | null)[]
  /** Where the data starts, for the empty row, when the list behind it is capped. */
  note?: string
}

interface Weekly {
  needs: ShapeName[]
  unit: ChartUnit
  /** How far back the data reaches, in weeks. */
  reach: number
  scopes?: string[]
  /** What the meta line names before the window. */
  stat?: string
  points(ctx: DataContext, starts: number[], scope: Scope): Points
}

const RUN_WEEKS = 12

/** The CI runs to read: the main workflow's, or the one the series is scoped to. */
function runsFor(ctx: DataContext, scope: Scope): WorkflowRunsShape {
  const runs = ctx.shapes.workflowRuns!
  return scope.workflow === undefined ? runs : { ...runs, runs: runs.runs.filter(r => r.workflowName === String(scope.workflow)) }
}

function byStart<W extends { weekStart: string }>(weeks: readonly W[], starts: number[], f: (w: W) => number | null): (number | null)[] {
  const at = new Map(weeks.map(w => [t(w.weekStart), w]))
  return starts.map(s => {
    const w = at.get(s)
    return w ? f(w) : null
  })
}

function ciWeeks(ctx: DataContext, starts: number[], scope: Scope) {
  return scope.workflow === undefined && ctx.shapes.ciDurationByWeek
    ? ctx.shapes.ciDurationByWeek.weeks
    : ciDurationByWeek(runsFor(ctx, scope), { now: ctx.now, weeks: starts.length }).weeks
}

// A run is never 0 ms long, so a zero percentile is a week with no timed runs, not a fast one.
const minutes = (ms: number) => (ms > 0 ? round1(ms / 60_000) : null)

/** The pull and issue lists are capped; a week that starts before they reach has no point. */
function covered(from: number, starts: number[], f: (start: number) => number | null): Points {
  return {
    points: starts.map(s => (s < from ? null : f(s))),
    ...(Number.isFinite(from) && from > starts[0]! ? { note: `the lists reach back to ${dateWords(from)}` } : {}),
  }
}

/** GitHub's commit stats start weeks on Sunday; a Monday week holds six days of one and the Sunday of the next. */
function commitDays(ctx: DataContext): Map<number, number> {
  const days = new Map<number, number>()
  for (const w of ctx.shapes['stats.commitActivity']!.weeks) w.days.forEach((n, i) => days.set(t(w.weekStart) + i * DAY, n))
  return days
}

/**
 * Per-author stats come only as Sunday weeks, so each lands on the Monday after its start: six of its seven
 * days fall in that Monday week.
 */
const contributorWeek = (weekStart: string) => t(weekStart) + DAY

const WEEKLY: Partial<Record<MeasureId, Weekly>> = {
  'ci-p50': {
    needs: ['workflowRuns'],
    unit: 'min',
    reach: RUN_WEEKS,
    scopes: ['workflow'],
    stat: 'p50',
    points: (ctx, starts, scope) => ({ points: byStart(ciWeeks(ctx, starts, scope), starts, w => minutes(w.p50Ms)) }),
  },
  'ci-p90': {
    needs: ['workflowRuns'],
    unit: 'min',
    reach: RUN_WEEKS,
    scopes: ['workflow'],
    stat: 'p90',
    points: (ctx, starts, scope) => ({ points: byStart(ciWeeks(ctx, starts, scope), starts, w => minutes(w.p90Ms)) }),
  },
  'failing-check-rate': {
    needs: ['workflowRuns'],
    unit: 'percent',
    reach: RUN_WEEKS,
    scopes: ['workflow'],
    points: (ctx, starts, scope) => {
      const weeks = scope.workflow === undefined && ctx.shapes.failureRateByWeek ? ctx.shapes.failureRateByWeek.weeks : failureRateByWeek(runsFor(ctx, scope), { now: ctx.now, weeks: starts.length }).weeks
      return { points: byStart(weeks, starts, w => (w.runs ? round1(w.rate * 100) : null)) }
    },
  },
  'flaky-rate': {
    needs: ['workflowRuns'],
    unit: 'percent',
    reach: RUN_WEEKS,
    scopes: ['workflow'],
    points: (ctx, starts, scope) => {
      const runs = ciRuns(runsFor(ctx, scope))
      return {
        points: starts.map(s => {
          const week = runs.filter(r => t(r.runStartedAt) >= s && t(r.runStartedAt) < s + WEEK)
          return week.length ? round1((week.filter(r => r.runAttempt > 1 && r.conclusion === 'success').length / week.length) * 100) : null
        }),
      }
    },
  },
  'prs-merged': {
    needs: ['activity'],
    unit: 'count',
    reach: 12,
    points: (ctx, starts) => ({ points: byStart(ctx.shapes.activity!.weeks, starts, w => w.pullsMerged) }),
  },
  'closure-ratio': {
    needs: ['activity'],
    // A chart has no ratio axis; closed per opened reads the same as a percent.
    unit: 'percent',
    reach: 12,
    points: (ctx, starts) => ({ points: byStart(closureRatio(ctx.shapes.activity!).weeks, starts, w => (w.ratio === null ? null : round1(w.ratio * 100))) }),
  },
  commits: {
    needs: ['stats.commitActivity'],
    unit: 'count',
    reach: 52,
    scopes: ['author'],
    points: (ctx, starts, scope) => {
      if (scope.author !== undefined) {
        const author = ctx.shapes['stats.contributors']?.authors.find(a => a.author.login.toLowerCase() === String(scope.author).toLowerCase())
        const weeks = new Map((author?.weeks ?? []).map(w => [contributorWeek(w.weekStart), w.commits]))
        return { points: starts.map(s => weeks.get(s) ?? null) }
      }
      const days = commitDays(ctx)
      return {
        points: starts.map(s => {
          if (!days.has(s)) return null
          let sum = 0
          for (let d = 0; d < 7; d++) sum += days.get(s + d * DAY) ?? 0
          return sum
        }),
      }
    },
  },
  contributors: {
    needs: ['stats.contributors'],
    unit: 'count',
    reach: 52,
    points: (ctx, starts) => {
      const authors = ctx.shapes['stats.contributors']!.authors.filter(a => !isBot(a.author))
      const listed = new Set(authors.flatMap(a => a.weeks.map(w => contributorWeek(w.weekStart))))
      return { points: starts.map(s => (listed.has(s) ? authors.filter(a => a.weeks.some(w => contributorWeek(w.weekStart) === s && w.commits > 0)).length : null)) }
    },
  },
  'core-share': {
    needs: ['pulls'],
    unit: 'percent',
    reach: 12,
    points: (ctx, starts) => coreWeeks(ctx, starts, share => share),
  },
  'community-share': {
    needs: ['pulls'],
    unit: 'percent',
    reach: 12,
    points: (ctx, starts) => coreWeeks(ctx, starts, share => 100 - share),
  },
  'review-wait-median': {
    needs: ['pulls'],
    unit: 'h',
    reach: 12,
    stat: 'median',
    points: (ctx, starts) => reviewWeeks(ctx, starts, 50),
  },
  'review-wait-p90': {
    needs: ['pulls'],
    unit: 'h',
    reach: 12,
    stat: 'p90',
    points: (ctx, starts) => reviewWeeks(ctx, starts, 90),
  },
  'time-to-close-median': {
    needs: ['pulls', 'issues'],
    unit: 'd',
    reach: 12,
    stat: 'median',
    points: (ctx, starts) => {
      const { pulls, issues } = ctx.shapes
      return covered(listCoverage(pulls, issues), starts, s => {
        const m = median(closeDays(pulls!.merged, issues!.closed, s, s + WEEK))
        return m === null ? null : round1(m)
      })
    },
  },
}

function coreWeeks(ctx: DataContext, starts: number[], f: (corePercent: number) => number): Points {
  const pulls = ctx.shapes.pulls!
  return covered(listCoverage(pulls), starts, s => {
    const merged = pulls.merged.filter(p => !isBot(p.author) && p.mergedAt !== null && t(p.mergedAt) >= s && t(p.mergedAt) < s + WEEK)
    return merged.length ? round1(f((merged.filter(p => CORE_ASSOCIATIONS.has(p.authorAssociation)).length / merged.length) * 100)) : null
  })
}

function reviewWeeks(ctx: DataContext, starts: number[], p: number): Points {
  const pulls = ctx.shapes.pulls!
  const all = [...pulls.open, ...pulls.merged]
  return covered(listCoverage(pulls), starts, s => {
    const v = percentile(reviewWaitHours(all, s, s + WEEK), p)
    return v === null ? null : round1(v)
  })
}

const WEEKS = { '12w': 12, '26w': 26, '52w': 52 } as const
const windowOf = (n: number): keyof typeof WEEKS => (n >= 52 ? '52w' : n >= 26 ? '26w' : '12w')

type Charted = { kind: 'chart'; bound: LineChartBound; notes: string[] } | { kind: 'error'; bound: LineChartBound; failed: string; cause: string }

function chart(ctx: DataContext, props: LineChartModel): Charted {
  const base: LineChartBound = {
    title: props.title,
    ...(props.meta ? { meta: props.meta } : {}),
    unit: 'count',
    weeks: [],
    series: props.series.map(s => ({ name: s.name, points: [] })),
    finding: props.finding,
  }
  const lead = props.series[0]!
  const fail = (failed: string, cause: string): Charted => ({ kind: 'error', bound: base, failed, cause })

  const defs: Weekly[] = []
  for (const s of props.series) {
    const def = WEEKLY[s.measure]
    const label = MEASURES[s.measure].label
    if (!def) return fail(`Couldn't chart ${lower(label)} by week`, 'GitHub keeps no weekly history for it')
    const odd = Object.keys(s.scope ?? {}).find(k => !def.scopes?.includes(k))
    if (odd) return fail(`Couldn't chart ${lower(label)} by week`, `It cannot be narrowed by ${odd}`)
    if (s.scope?.author !== undefined && !ctx.shapes['stats.contributors']) return fail("Couldn't load commit authors", missingCause(ctx, ['stats.contributors']))
    const missing = def.needs.filter(n => !ctx.shapes[n])
    if (missing.length) return fail(`Couldn't load ${lower(label)}`, missingCause(ctx, missing))
    defs.push(def)
  }
  const unit = defs[0]!.unit
  if (defs.some(d => d.unit !== unit)) return fail(`Couldn't chart ${props.series.map(s => s.name).join(' and ')} together`, 'They are not measured in the same unit')

  const asked = WEEKS[props.window ?? '12w']
  // The failure strip reads CI runs, which reach back 12 weeks; a longer line would sit over weeks with no strip.
  const n = Math.min(asked, ...defs.map(d => d.reach), props.failures ? RUN_WEEKS : Infinity)
  const starts = weekStarts(ctx.now, n)
  const read = props.series.map((s, i) => defs[i]!.points(ctx, starts, s.scope ?? {}))
  const stat = defs[0]!.stat
  const systemMeta = `${stat ? `${stat} · ` : ''}${WINDOW_WORDS[windowOf(n)]}`

  let failures: number[] | undefined
  if (props.failures && ctx.shapes.workflowRuns) {
    const weeks = ciWeeks(ctx, starts, lead.scope?.workflow !== undefined ? { workflow: lead.scope.workflow } : {})
    failures = byStart(weeks, starts, w => w.failures).map(f => f ?? 0)
  }

  return {
    kind: 'chart',
    notes: read.flatMap(r => (r.note ? [r.note] : [])),
    bound: {
      ...base,
      // The model's meta names a window; when the data could not reach it, the system says what the chart holds.
      meta: props.meta && n === asked ? props.meta : systemMeta,
      unit,
      weeks: starts.map(isoDay),
      series: props.series.map((s, i) => ({ name: s.name, points: read[i]!.points })),
      ...(failures ? { failures } : {}),
    },
  }
}

const UNIT_AFTER: Record<ChartUnit, string> = { min: ' min', h: ' h', d: ' days', count: '', percent: '%' }

/** A plain sentence about the lead series whose every number passes LineChart's own check. */
export function systemFinding(ctx: DataContext, props: LineChartModel): string {
  const charted = chart(ctx, props)
  const lead = props.series[0]!
  const label = MEASURES[lead.measure].label
  if (charted.kind === 'error') return `${label} by week.`
  const { unit, series } = charted.bound
  const points = series[0]!.points
  const known = points.flatMap((v, i) => (v === null ? [] : [{ v, i }]))
  const say = (v: number) => `${formatChartValue(v, unit)}${UNIT_AFTER[unit]}`
  const first = known[0]
  const last = known.at(-1)
  if (!first || !last) return `No ${lower(label)} to chart yet.`
  if (first === last) return `${label} was ${say(first.v)} in the only week with data.`
  const span = first.i === 0 && last.i === points.length - 1 ? `over ${points.length} weeks` : 'across the weeks with data'
  const move = first.v === last.v ? `held at ${say(last.v)}` : `went from ${unit === 'percent' ? say(first.v) : formatChartValue(first.v, unit)} to ${say(last.v)}`
  return `${label} ${move} ${span}.`
}

export const bindLineChart: Binder<LineChartModel> = (ctx, props, extras) => {
  const charted = chart(ctx, props)
  if (charted.kind === 'error') return unavailable(COMPONENT, props, charted.bound, { failed: charted.failed, cause: charted.cause }, extras)
  const b = charted.bound
  if (b.series.every(s => s.points.every(p => p === null))) {
    return empty(
      COMPONENT,
      props,
      {
        ...b,
        emptyTone: props.emptyTone ?? 'neutral',
        empty: props.empty ?? `Nothing to chart in the ${WINDOW_WORDS[windowOf(b.weeks.length)]}`,
        ...(charted.notes[0] ? { emptyMeta: charted.notes[0] } : {}),
      },
      extras,
    )
  }
  return bound(COMPONENT, props, b, extras)
}
