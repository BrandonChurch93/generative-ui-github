import {
  computeMeasure,
  DEFAULT_WINDOW,
  MEASURES,
  measureNeeds,
  SHAPE_KIND,
  type MeasureId,
  type MeasureResult,
  type MeasureScope,
  type MeasureWindow,
  type ShapeMap,
  type ShapeName,
} from '@genui-github/data'
import type { ErrorInfo } from '@genui-github/ui'
import type { DataContext } from './types'

// Helpers the group A binders share: reading measures and shapes from the context, and the system's words
// for times, windows and missing data.

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** A shape from the context, without its `cachedAt`. */
export function shape<K extends ShapeName>(ctx: DataContext, name: K): ShapeMap[K] | undefined {
  return ctx.shapes[name] as ShapeMap[K] | undefined
}

/** Why a shape the piece needs is not in the context, in the system's words. */
export function absentCause(ctx: DataContext, names: readonly ShapeName[]): string {
  const missing = names.filter(n => !ctx.shapes[n])
  if (missing.some(n => ctx.unavailable.includes(n))) return "GitHub doesn't count this for the repo"
  if (ctx.warming && missing.some(n => SHAPE_KIND[n] === 'stats')) return 'GitHub is still counting it'
  return "Not in this answer's data"
}

export const missingData = (ctx: DataContext, failed: string, names: readonly ShapeName[]): ErrorInfo => ({ failed, cause: absentCause(ctx, names) })

/** Computes a measure for the props' window and scope, on top of the scope the template asked for. */
export function readMeasure<Id extends MeasureId>(ctx: DataContext, id: Id, options: { window?: MeasureWindow; scope?: MeasureScope } = {}): MeasureResult<Id> | null {
  const cachedAt = Object.fromEntries(Object.entries(ctx.shapes).map(([k, v]) => [k, (v as { cachedAt: string }).cachedAt]))
  const scope = { ...ctx.scope, ...options.scope }
  return computeMeasure(id, { now: ctx.now, shapes: ctx.shapes as Partial<ShapeMap>, cachedAt, scope }, options.window ?? DEFAULT_WINDOW[id])
}

/** The shapes a measure reads that the context does not hold. */
export function measureGaps(ctx: DataContext, id: MeasureId, scope: MeasureScope = {}): ShapeName[] {
  return measureNeeds(id, { ...ctx.scope, ...scope }).filter(n => !ctx.shapes[n])
}

/** "12m", "6h", "9d": how long ago, or how long, in the units a meta line uses. */
export function span(ms: number): string {
  const v = Math.max(0, ms)
  if (v < HOUR) return `${Math.max(1, Math.round(v / MINUTE))}m`
  if (v < DAY) return `${Math.round(v / HOUR)}h`
  return `${Math.floor(v / DAY)}d`
}

export const ago = (iso: string, now: number) => `${span(now - Date.parse(iso))} ago`

/** "Oct 1", in the viewer's zone. */
export function shortDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone }).format(new Date(iso))
}

/** A label inside a sentence: the first letter lowered unless the word is an acronym ("CI run at p90"). */
export function inline(label: string): string {
  return /^[A-Z]{2}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1)
}

const ATTACHED = new Set(['h', 'd', '%', '×'])
/** The figure with its suffix, as a sentence writes it: "1.1h", "57 of 421", "11.3 min". */
export function figure(result: MeasureResult): string {
  const { text, suffix } = result.formatted
  if (!suffix) return text
  return ATTACHED.has(suffix) ? `${text}${suffix}` : `${text} ${suffix}`
}

const LEADING: ReadonlySet<MeasureId> = new Set(['bus-factor', 'busiest-hour', 'quietest-day', 'milestone-closes', 'failing-since'])

/** A measure in words for a source line or a default sentence: "57 of 421 failing checks", "median CI run 11.3 min". */
export function measureWords(result: MeasureResult): string {
  const label = inline(MEASURES[result.id].label)
  const counted = result.unit === 'count' || result.unit === 'count-of-total'
  return counted && !LEADING.has(result.id) ? `${figure(result)} ${label}` : `${label} ${figure(result)}`
}

/** The figures a series can honestly be quoted with: its points, how many weeks, and the change first to last. */
export function seriesFacts(points: readonly number[]): number[] {
  if (!points.length) return []
  const first = points[0]!
  const last = points.at(-1)!
  const facts = [...points, points.length, Math.abs(last - first), Math.min(...points), Math.max(...points)]
  if (first !== 0) facts.push(Math.abs(((last - first) / first) * 100))
  return facts
}

/** Every figure a measure's prose may cite: the value, the part, the whole and the rest, and its series. */
export function measureNumbers(result: MeasureResult, now: number): number[] {
  const v = result.value as unknown
  const out: number[] = []
  if (typeof v === 'number') out.push(v)
  else if (typeof v === 'object' && v !== null) {
    const { count, total } = v as { count: number; total: number }
    out.push(count, total, total - count)
    if (total > 0) out.push((count / total) * 100)
  } else if (typeof v === 'string' && result.unit === 'clock') {
    // A due date: the day of the month, and the days left until it.
    const due = Date.parse(v)
    if (Number.isFinite(due)) out.push(new Date(due).getUTCDate(), Math.ceil((due - now) / DAY))
  }
  if (result.series12w) out.push(...seriesFacts(result.series12w))
  return out
}

/** The window a measure reads when the props name none. */
export const windowOf = (id: MeasureId, window?: MeasureWindow): MeasureWindow => window ?? DEFAULT_WINDOW[id]

/** A pull request or issue reference as the reader sees it. */
export const ref = (n: number) => `#${n}`

export const sha7 = (sha: string) => sha.slice(0, 7)

/** A window inside a sentence: "in the last 7 days", "this week". */
export const during = (words: string) => (words.startsWith('last') ? `in the ${words}` : words)
