// The measure catalog from docs/schemas.md. The model names a measure; the data layer computes it; nothing here fetches.

export const UNITS = ['count', 'count-of-total', 'h', 'd', 'ratio', 'min', 'percent', 'runs', 'clock', 'text'] as const
export type Unit = (typeof UNITS)[number]

export type Better = 'higher' | 'lower' | 'neutral'

/** What a measure's value looks like, by unit. */
export interface UnitValue {
  count: number
  'count-of-total': { count: number; total: number }
  h: number
  d: number
  ratio: number
  min: number
  percent: number
  runs: number
  /** An hour of the day (0 to 23), or an ISO date. */
  clock: number | string
  text: string
}

/** The number as Metric draws it: the figure, and the mono suffix beside it. */
export interface Formatted {
  text: string
  suffix?: string
}

const oneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

const formatters: { [U in Unit]: (value: UnitValue[U]) => Formatted } = {
  count: v => ({ text: whole.format(v) }),
  'count-of-total': v => ({ text: whole.format(v.count), suffix: `of ${whole.format(v.total)}` }),
  h: v => ({ text: oneDecimal.format(v), suffix: 'h' }),
  d: v => ({ text: oneDecimal.format(v), suffix: 'd' }),
  ratio: v => ({ text: oneDecimal.format(v), suffix: '×' }),
  min: v => ({ text: oneDecimal.format(v), suffix: 'min' }),
  percent: v => ({ text: oneDecimal.format(v), suffix: '%' }),
  runs: v => ({ text: whole.format(v), suffix: v === 1 ? 'run' : 'runs' }),
  clock: v => (typeof v === 'number' ? { text: `${String(v).padStart(2, '0')}:00` } : { text: shortDate.format(new Date(v)) }),
  text: v => ({ text: v }),
}

export function formatValue<U extends Unit>(unit: U, value: UnitValue[U]): Formatted {
  return formatters[unit](value)
}

export interface MeasureDef<U extends Unit = Unit> {
  unit: U
  better: Better
  /** The Metric label when the model does not write one. Sentence case, at most 28 characters. */
  label: string
  /** One line for the registry prompt. */
  what: string
}

function m<U extends Unit>(unit: U, better: Better, label: string, what: string): MeasureDef<U> {
  return { unit, better, label, what }
}

export const MEASURES = {
  'open-prs': m('count', 'neutral', 'Open pull requests', 'open pull requests, optionally on a milestone'),
  'awaiting-review': m('count', 'lower', 'Awaiting review', 'open PRs with no review decision'),
  'changes-requested': m('count', 'lower', 'Changes requested', 'open PRs with changes requested'),
  'failing-checks': m('count-of-total', 'lower', 'Failing checks', 'failing check runs on the default branch head'),
  'milestone-issues-open': m('count-of-total', 'lower', 'Open milestone issues', 'open issues on the next milestone'),
  'prs-merged': m('count', 'higher', 'Pull requests merged', 'merged in the window'),
  'review-wait-median': m('h', 'lower', 'Median review wait', 'time to first human review, median'),
  'review-wait-p90': m('h', 'lower', 'Review wait at p90', 'time to first human review, p90'),
  'time-to-close-median': m('d', 'lower', 'Median time to close', 'issues and PRs opened to closed'),
  'closure-ratio': m('ratio', 'higher', 'Closure ratio', 'closed divided by opened in the window'),
  'ci-p50': m('min', 'lower', 'Median CI run', 'workflow run duration p50 on the default branch'),
  'ci-p90': m('min', 'lower', 'CI run at p90', 'workflow run duration p90 on the default branch'),
  'failing-check-rate': m('percent', 'lower', 'Failing run rate', 'failed runs divided by runs'),
  'flaky-rate': m('percent', 'lower', 'Flaky run rate', 'runs that passed on rerun divided by runs'),
  'slowest-job': m('min', 'lower', 'Slowest job', 'the slowest job in the slowest run'),
  'failing-since': m('runs', 'lower', 'Failing for', 'consecutive runs the current failure has persisted'),
  'pr-size': m('count', 'neutral', 'Lines changed', 'lines changed in a PR, additions plus deletions'),
  contributors: m('count', 'higher', 'Contributors', 'distinct human authors in the window'),
  'first-time-contributors': m('count', 'higher', 'First-time contributors', 'authors with their first merge in the window'),
  'bus-factor': m('count', 'higher', 'Bus factor', 'smallest n making 50% of commits'),
  'core-share': m('percent', 'neutral', 'Core team share', 'owner-org commits divided by all'),
  'community-share': m('percent', 'neutral', 'Community share', 'non-owner-org commits divided by all'),
  'stale-issues': m('count', 'lower', 'Stale issues', 'open issues with no activity for 30 days'),
  'good-first-issues': m('count', 'neutral', 'Good first issues', 'open issues labeled good first issue or help wanted'),
  stars: m('count', 'higher', 'Stars', 'stargazers'),
  commits: m('count', 'neutral', 'Commits', 'commits in the window'),
  'files-changed': m('count', 'neutral', 'Files changed', 'in a PR or between two tags'),
  'busiest-hour': m('clock', 'neutral', 'Busiest hour', "the punch card's peak hour"),
  'quietest-day': m('text', 'neutral', 'Quietest day', "the punch card's lowest weekday"),
  'milestone-closes': m('clock', 'neutral', 'Milestone due', "the next milestone's due date"),
} as const satisfies Record<string, MeasureDef>

export type MeasureId = keyof typeof MEASURES
export const MEASURE_IDS = Object.keys(MEASURES) as MeasureId[]

export type MeasureUnit<Id extends MeasureId> = (typeof MEASURES)[Id]['unit']

export function isMeasureId(id: string): id is MeasureId {
  return Object.hasOwn(MEASURES, id)
}

/** A Metric with a clock or text unit wipes in instead of counting. */
export function countsIn(id: MeasureId): boolean {
  const unit = MEASURES[id].unit
  return unit !== 'clock' && unit !== 'text'
}

/** What the data layer returns for a measure, for a repo and a window. */
export interface MeasureResult<Id extends MeasureId = MeasureId> {
  id: Id
  value: UnitValue[MeasureUnit<Id>]
  unit: MeasureUnit<Id>
  formatted: Formatted
  /** Twelve weekly values, only when the data covers all twelve weeks. */
  series12w?: number[]
  /** Set when the data starts after the window does: the value covers from here, not the whole window. */
  coveredFrom?: string
  cachedAt: string
}
