import { formatValue, mainWorkflow, MEASURES, nextMilestone, type MeasureId, type MeasureResult, type MeasureScope } from '@genui-github/data'
import { bound, empty, unavailable, type Binder, type DataContext } from './types'
import { absentCause, measureGaps, measureNumbers, readMeasure, shape, shortDate, windowOf } from './group-a-shared'
import { WINDOW_WORDS, type MetricModelProps, type MetricProps, type Window } from './group-a-ui'

// Metric: the model names a measure, a window and a scope; the system computes the number, its suffix, its
// 12-week series and the window in words.

const BRANCH_ONLY: ReadonlySet<MeasureId> = new Set(['failing-checks', 'ci-p50', 'ci-p90', 'failing-check-rate', 'flaky-rate', 'slowest-job', 'failing-since'])
const PER_PR: ReadonlySet<MeasureId> = new Set(['pr-size', 'files-changed'])
const PER_MILESTONE: ReadonlySet<MeasureId> = new Set(['open-prs', 'awaiting-review', 'changes-requested', 'milestone-issues-open', 'milestone-closes'])

type ScopeRead = { scope: MeasureScope } | { refused: string }

/** The props' scope string as the data layer reads it: a PR number, a milestone, or the default branch. */
function readScope(ctx: DataContext, id: MeasureId, scope: string | undefined): ScopeRead {
  if (!scope) return { scope: {} }
  const text = scope.trim()
  const pr = /^#?(\d+)$/.exec(text)
  if (pr) return PER_PR.has(id) ? { scope: { pr: Number(pr[1]) } } : { refused: 'Not measured per pull request' }
  if (PER_MILESTONE.has(id)) return { scope: { milestone: text } }
  if (text === ctx.repo.defaultBranch) return { scope: {} }
  return { refused: BRANCH_ONLY.has(id) ? `Only ${ctx.repo.defaultBranch} is in this answer's data` : 'Not measured per branch' }
}

const EMPTY_WORDS: Partial<Record<MeasureId, string>> = {
  'review-wait-median': 'No first responses in this window',
  'review-wait-p90': 'No first responses in this window',
  'time-to-close-median': 'Nothing closed in this window',
  'closure-ratio': 'Nothing opened in this window',
  'ci-p50': 'No CI runs in this window',
  'ci-p90': 'No CI runs in this window',
  'failing-check-rate': 'No CI runs in this window',
  'flaky-rate': 'No CI runs in this window',
  'slowest-job': 'No timed CI run in 30 days',
  'failing-checks': 'No check runs on the head commit',
  'pr-size': 'No open pull requests',
  'files-changed': 'No changed files listed',
  'core-share': 'No merges in this window',
  'community-share': 'No merges in this window',
  'busiest-hour': 'No commits on the punch card',
  'quietest-day': 'No commits on the punch card',
  contributors: 'No commits in this window',
  commits: 'No commits in this window',
}

/** Why a measure with all its data came back empty, in the system's words. */
export function emptyMessage(ctx: DataContext, id: MeasureId, scope: MeasureScope = {}): string {
  if (id === 'milestone-issues-open' || id === 'milestone-closes') return scope.milestone ? `No open milestone named ${scope.milestone}` : 'No release milestone with a due date'
  if (id === 'failing-since') return `No CI runs on ${ctx.repo.defaultBranch}`
  return EMPTY_WORDS[id] ?? 'Nothing to measure in this window'
}

/** What the number covers, in words: the window, the scope, or where the listed data starts. */
export function windowWords(ctx: DataContext, id: MeasureId, window: Window, result: MeasureResult | null, scope: MeasureScope = {}): string {
  if (result?.coveredFrom) return `since ${shortDate(result.coveredFrom, ctx.timeZone)}`
  const merged = { ...ctx.scope, ...scope }
  const words = WINDOW_WORDS[window]
  const tags = shape(ctx, 'commitsBetweenTags')
  const between = merged.release && tags ? `${tags.base} to ${tags.head}` : undefined
  const runs = shape(ctx, 'workflowRuns')
  const workflow = runs ? mainWorkflow(runs) : null
  const milestone = merged.milestone ?? (shape(ctx, 'milestones') ? nextMilestone(shape(ctx, 'milestones')!)?.title : undefined)
  switch (id) {
    case 'open-prs':
    case 'awaiting-review':
    case 'changes-requested':
      return merged.milestone ? `on ${merged.milestone}` : 'open now'
    case 'good-first-issues':
      return 'open now'
    case 'stale-issues':
      return 'idle 30 days or more'
    case 'failing-checks':
      return `${ctx.repo.defaultBranch} head`
    case 'failing-since':
      return `on ${ctx.repo.defaultBranch}`
    case 'milestone-issues-open':
    case 'milestone-closes':
      return milestone ? `milestone ${milestone}` : words
    case 'stars':
      return 'all time'
    case 'pr-size':
    case 'files-changed': {
      if (between && id === 'files-changed') return between
      const pr = merged.pr ?? shape(ctx, 'biggestOpenPr')?.pull?.number
      return pr ? `#${pr}` : words
    }
    case 'busiest-hour':
    case 'quietest-day':
      return 'in your time zone'
    case 'ci-p50':
    case 'ci-p90':
    case 'failing-check-rate':
    case 'flaky-rate':
      return workflow ? `${workflow} · ${words}` : words
    case 'commits':
    case 'contributors':
      if (between) return between
      return merged.author && id === 'commits' ? `by ${merged.author} · ${words}` : words
    default:
      return words
  }
}

const oneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** The trend in words for the Sparkline's label. Every figure is a point of the series or its length. */
export function systemSparkFinding(id: MeasureId, points: readonly number[]): string {
  const unit = MEASURES[id].unit
  const counted = unit === 'count' || unit === 'runs'
  const f = (v: number) => {
    const n = counted ? whole.format(v) : oneDecimal.format(v)
    return unit === 'percent' ? `${n}%` : unit === 'ratio' ? `${n}×` : n
  }
  const tail = counted ? ' a week' : unit === 'min' ? ' min' : unit === 'h' ? ' hours' : unit === 'd' ? ' days' : ''
  const first = points[0] ?? 0
  const last = points.at(-1) ?? 0
  const weeks = `over ${points.length} weeks`
  if (f(first) === f(last)) return `Flat at ${f(last)}${tail} ${weeks}`
  return `${last > first ? 'Up' : 'Down'} from ${f(first)} to ${f(last)}${tail} ${weeks}`
}

const tenth = (v: number) => (Number.isInteger(v) ? v : Math.round(v * 10) / 10)

function drawn(result: MeasureResult): Pick<MetricProps, 'value' | 'suffix' | 'format'> {
  const unit = result.unit
  const format = unit === 'clock' ? 'clock' : unit === 'text' ? 'text' : 'count'
  const raw = result.value as unknown
  const value = format !== 'count' ? result.formatted.text : typeof raw === 'number' ? tenth(raw) : (raw as { count: number }).count
  return { value, format, ...(result.formatted.suffix ? { suffix: result.formatted.suffix } : {}) }
}

/** A milestone named in the props, which the catalog's due-date measure reads only for the next one. */
function milestoneDue(ctx: DataContext, title: string): MeasureResult<'milestone-closes'> | null {
  const m = shape(ctx, 'milestones')?.open.find(x => x.title === title)
  if (!m?.dueOn) return null
  return { id: 'milestone-closes', value: m.dueOn, unit: 'clock', formatted: formatValue('clock', m.dueOn), cachedAt: ctx.shapes.milestones!.cachedAt }
}

export const bindMetric: Binder<MetricModelProps> = (ctx, props, extras = {}) => {
  const id = props.measure
  const label = props.label ?? MEASURES[id].label
  const window = windowOf(id, props.window) as Window
  const chosen = {
    measure: id,
    label,
    ...(props.window ? { window: props.window } : {}),
    ...(props.scope ? { scope: props.scope } : {}),
    ...(props.delta ? { delta: props.delta } : {}),
    ...(props.deltaTone ? { deltaTone: props.deltaTone } : {}),
    ...(props.hot !== undefined ? { hot: props.hot } : {}),
  }
  const frame = (windowWordsText: string): MetricProps => ({ ...chosen, value: 0, format: 'count', windowWords: windowWordsText })

  const read = readScope(ctx, id, props.scope)
  if ('refused' in read) return unavailable('Metric', props, frame(WINDOW_WORDS[window]), { failed: "Couldn't load", cause: read.refused }, extras)
  const { scope } = read

  const milestones = shape(ctx, 'milestones')
  if (scope.milestone && milestones && !milestones.open.some(m => m.title === scope.milestone)) {
    return empty('Metric', props, { ...frame(WINDOW_WORDS[window]), message: emptyMessage(ctx, id, scope) }, extras)
  }

  const result = id === 'milestone-closes' && scope.milestone ? milestoneDue(ctx, scope.milestone) : readMeasure(ctx, id, { window, scope })
  const words = windowWords(ctx, id, window, result, scope)
  if (!result) {
    const gaps = measureGaps(ctx, id, scope)
    if (gaps.length) return unavailable('Metric', props, frame(words), { failed: "Couldn't load", cause: absentCause(ctx, gaps) }, extras)
    return empty('Metric', props, { ...frame(words), message: emptyMessage(ctx, id, scope) }, extras)
  }

  const series = props.trend && result.series12w ? { points: result.series12w.map(tenth), finding: systemSparkFinding(id, result.series12w) } : undefined
  const boundProps: MetricProps = { ...chosen, ...drawn(result), ...(series ? { series } : {}), windowWords: words }
  return bound('Metric', props, boundProps, { ...extras, ...(props.delta ? { cites: measureNumbers(result, ctx.now) } : {}) })
}
