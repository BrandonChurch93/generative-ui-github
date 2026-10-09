import { isBot, listCoverage, type Pull } from '@genui-github/data'
import { validateNumbers } from '@genui-github/ui/schemas'
import { Heatmap, HeatmapHeat } from '@genui-github/ui/schemas'
import { bound, empty, unavailable, type Binder, type DataContext } from './types'
import { dateWords, missingCause } from './group-b-ui'

type HeatmapModel = Heatmap.HeatmapModelProps
type HeatmapBound = Heatmap.HeatmapProps
const { DAYS, UNIT_WORDS, WINDOW_LABELS } = Heatmap

const COMPONENT = 'Heatmap'
const HOURS = 24
const WEEK = 7 * 86_400_000
/** Decision 45: the punch card is repo wide, so its title never names a person. */
const COMMITS_TITLE = 'When commits land'
const t = (iso: string) => Date.parse(iso)

const zero = () => Array.from({ length: DAYS.length }, () => Array.from({ length: HOURS }, () => 0))

function zoneWords(timeZone: string, at: number): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(new Date(at)).find(p => p.type === 'timeZoneName')
  return part?.value ?? timeZone
}

/** Counts events by weekday and hour in the viewer's zone, Monday first. */
function place(times: number[], timeZone: string): number[][] {
  const format = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: 'numeric', hourCycle: 'h23' })
  const counts = zero()
  for (const at of times) {
    const parts = format.formatToParts(new Date(at))
    const day = DAYS.findIndex(d => d.short === parts.find(p => p.type === 'weekday')?.value)
    const hour = Number(parts.find(p => p.type === 'hour')?.value) % HOURS
    if (day >= 0 && Number.isInteger(hour)) counts[day]![hour]! += 1
  }
  return counts
}

const humanReviews = (p: Pull) => p.reviews.filter(r => !isBot(r.author) && r.author.login !== p.author.login)

type Placed = { kind: 'counts'; bound: HeatmapBound } | { kind: 'error'; bound: HeatmapBound; failed: string; cause: string }

function placeAll(ctx: DataContext, props: HeatmapModel): Placed {
  const many = UNIT_WORDS[props.unit].many
  const punch = ctx.shapes['stats.punchCard']
  const base: HeatmapBound = {
    ...props,
    ...(props.unit === 'commits' ? { title: COMMITS_TITLE } : {}),
    counts: zero(),
    zone: zoneWords(punch && props.unit === 'commits' ? punch.timeZone : ctx.timeZone, ctx.now),
  }
  const fail = (failed: string, cause: string): Placed => ({ kind: 'error', bound: base, failed, cause })

  if (props.unit === 'commits') {
    if (!punch) return fail("Couldn't load commits by hour", missingCause(ctx, ['stats.punchCard']))
    const counts = zero()
    for (const c of punch.cells) if (counts[c.day]?.[c.hour] !== undefined) counts[c.day]![c.hour] = c.commits
    return { kind: 'counts', bound: { ...base, counts } }
  }
  if (props.unit === 'comments') return fail("Couldn't count comments by hour", 'The lists read here hold no comment times')

  const pulls = ctx.shapes.pulls
  if (!pulls) return fail(`Couldn't load ${many} by hour`, missingCause(ctx, ['pulls']))
  const from = ctx.now - WINDOW_LABELS[props.window].weeks * WEEK
  const reach = listCoverage(pulls)
  // The merged list is capped; a window it does not reach would undercount the early weeks as quiet ones.
  if (reach > from) return fail(`Couldn't count ${many} by hour`, `The pull request list reaches back to ${dateWords(reach)} only`)
  const inWindow = (at: number) => at >= from && at <= ctx.now
  const times =
    props.unit === 'merges'
      ? pulls.merged.filter(p => !isBot(p.author) && p.mergedAt !== null).map(p => t(p.mergedAt!))
      : [...pulls.open, ...pulls.merged].flatMap(p => humanReviews(p).map(r => t(r.submittedAt)))
  return { kind: 'counts', bound: { ...base, counts: place(times.filter(inWindow), ctx.timeZone) } }
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

/**
 * The summary when the model wrote none: the peak hour and the quietest day, every figure a cell or a day
 * total, and no window, since the commit punch card is all time.
 */
export function systemSummary(ctx: DataContext, props: HeatmapModel): string {
  const placed = placeAll(ctx, props)
  const many = UNIT_WORDS[props.unit].many
  if (placed.kind === 'error') return `${many.charAt(0).toUpperCase()}${many.slice(1)} by weekday and hour.`
  const { counts } = placed.bound
  const peak = HeatmapHeat.peakCells(counts)[0]
  if (!peak) return `No ${many} to place by hour yet.`
  const n = counts[peak.day]![peak.hour]!
  const totals = counts.map(sum)
  const quiet = totals.indexOf(Math.min(...totals))
  const words = `${many.charAt(0).toUpperCase()}${many.slice(1)} peak on ${DAYS[peak.day]!.long} at ${HeatmapHeat.timeLabel(peak.hour)}, ${n} in that hour; ${DAYS[quiet]!.long} is the quietest day.`
  const facts = HeatmapHeat.heatFacts(counts, WINDOW_LABELS[props.window].weeks)
  return validateNumbers(words.replace(/\b\d{1,2}:00\b/g, s => ' '.repeat(s.length)), facts).ok ? words : `${many.charAt(0).toUpperCase()}${many.slice(1)} by weekday and hour.`
}

export const bindHeatmap: Binder<HeatmapModel> = (ctx, props, extras) => {
  const placed = placeAll(ctx, props)
  if (placed.kind === 'error') return unavailable(COMPONENT, props, placed.bound, { failed: placed.failed, cause: placed.cause }, extras)
  if (placed.bound.counts.every(row => row.every(c => c === 0))) {
    const many = UNIT_WORDS[props.unit].many
    const none = props.unit === 'commits' ? `No ${many} yet` : `No ${many} in the ${WINDOW_LABELS[props.window].words}`
    return empty(COMPONENT, props, { ...placed.bound, emptyTone: props.emptyTone ?? 'neutral', empty: props.empty ?? none }, extras)
  }
  return bound(COMPONENT, props, placed.bound, extras)
}
