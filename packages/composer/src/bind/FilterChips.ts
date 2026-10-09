import { windowSpan, type MeasureWindow } from '@genui-github/data'
import { createLogger } from '@genui-github/core'
import { windowSchema, type FilterChips } from '@genui-github/ui/schemas'
import { bound, unavailable, type Binder, type DataContext } from './types'

type FilterChipsModel = FilterChips.FilterChipsModelProps
type Bound = Omit<FilterChips.FilterChipsProps, 'onChange'>

const COMPONENT = 'FilterChips'
const log = createLogger('bind:filterchips')
const WINDOWS = new Set<string>(windowSchema.options)
const t = (iso: string) => Date.parse(iso)

/** One thing a target lists: when it is dated (opened, merged, last touched) and its labels. */
interface Row {
  at: number
  labels: string[]
}

interface Pool {
  rows: Row[]
  /** What the chips narrow, for the group's name. */
  noun: string
  /** Issue lists filter by how long they have sat idle; everything else by when it happened. */
  idle: boolean
}

/** The target's kind and scope, read back from its stable id: `statuslist:issue:milestone-v16.2`, `timeline:merged:7d`. */
function poolFor(ctx: DataContext, target: string): Pool | null {
  const [component, kind, ...rest] = target.split(':')
  const scope = rest.join(':')
  const scoped = (key: string) => (scope.startsWith(`${key}-`) ? scope.slice(key.length + 1) : undefined)
  const milestone = scoped('milestone')
  const author = scoped('author')?.toLowerCase()
  const labels = scoped('labels')?.split('+')
  const keep = (x: { milestone: string | null; author: { login: string }; labels: string[] }) =>
    (!milestone || x.milestone === milestone) && (!author || x.author.login.toLowerCase() === author) && (!labels || labels.every(l => x.labels.includes(l)))

  if (component === 'statuslist' && kind === 'issue' && ctx.shapes.issues) {
    return { rows: ctx.shapes.issues.open.filter(keep).map(i => ({ at: t(i.updatedAt), labels: i.labels })), noun: 'open issues', idle: true }
  }
  if (component === 'statuslist' && kind === 'pull' && ctx.shapes.pulls) {
    if (scope === 'merged') return { rows: ctx.shapes.pulls.merged.filter(p => p.mergedAt).map(p => ({ at: t(p.mergedAt!), labels: p.labels })), noun: 'merged pull requests', idle: false }
    return { rows: ctx.shapes.pulls.open.filter(keep).map(p => ({ at: t(p.createdAt), labels: p.labels })), noun: 'open pull requests', idle: false }
  }
  if (component === 'timeline' && kind === 'merged' && ctx.shapes.pulls) {
    return { rows: ctx.shapes.pulls.merged.filter(p => p.mergedAt && keep(p)).map(p => ({ at: t(p.mergedAt!), labels: p.labels })), noun: 'merged pull requests', idle: false }
  }
  if (component === 'timeline' && kind === 'commits' && ctx.shapes.commits) {
    return { rows: ctx.shapes.commits.commits.map(c => ({ at: t(c.date), labels: [] })), noun: 'commits', idle: false }
  }
  return null
}

/** What each chip would show, counted from the target's data. A window counts what falls in it, or for issues what has sat idle that long. */
function count(ctx: DataContext, pool: Pool, value: string, label: string): number {
  if (WINDOWS.has(value)) {
    const span = windowSpan(value as MeasureWindow, ctx.now)
    const length = span.to - span.from
    return pool.rows.filter(r => (pool.idle ? ctx.now - r.at >= length : r.at >= span.from && r.at <= span.to)).length
  }
  const names = [value.toLowerCase(), label.toLowerCase()]
  return pool.rows.filter(r => r.labels.some(l => names.includes(l.toLowerCase()))).length
}

/**
 * Each option's count and the group's name, from the target's data. Without a target (chips inside a Form),
 * from the repo's recent merges, or its recent commits when merges were not read. Null when nothing is there to count.
 */
export function chipCounts(ctx: DataContext, target: string | undefined, options: readonly { value: string; label: string }[]): { counts: Record<string, number>; filters: string } | null {
  const pool = poolFor(ctx, target ?? (ctx.shapes.pulls ? 'timeline:merged' : 'timeline:commits'))
  if (!pool) return null
  const counts = Object.fromEntries(options.map(o => [o.value, count(ctx, pool, o.value, o.label)]))
  const byWindow = options.every(o => WINDOWS.has(o.value))
  return { counts, filters: `${pool.noun} by ${byWindow ? (pool.idle ? 'time idle' : 'window') : 'label'}` }
}

/** The chips the model chose, with each one's count from the target's data. The renderer wires `onChange`. */
export const bindFilterChips: Binder<FilterChipsModel> = (ctx, props, extras = {}) => {
  const found = chipCounts(ctx, props.target, props.options)
  if (!found) {
    log.debug('no data to count for the target', { target: props.target })
    return unavailable(COMPONENT, props, { ...props } satisfies Bound, { failed: "Couldn't count the filters", cause: "The card below is not in this answer's data" }, extras)
  }
  return bound(COMPONENT, props, { ...props, ...found } satisfies Bound, extras)
}
