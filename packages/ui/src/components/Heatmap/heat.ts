import { createLogger } from '@genui-github/core'
import { validateNumbers } from '../../validate/numbers'
import { DAYS, UNIT_WORDS, WINDOW_LABELS, type HeatmapProps, type HeatmapUnit } from './schema'

const log = createLogger('ui:heatmap')

export const HOURS = 24
export const STEPS = 5

export interface Cell {
  day: number
  hour: number
}

export const hourLabel = (hour: number) => String(hour).padStart(2, '0')
export const timeLabel = (hour: number) => `${hourLabel(hour)}:00`
export const unitWord = (unit: HeatmapUnit, n: number) => (n === 1 ? UNIT_WORDS[unit].one : UNIT_WORDS[unit].many)

export function peakOf(counts: number[][]): number {
  return Math.max(0, ...counts.flat())
}

/**
 * Linear ceil binning: the peak is always step 5, and with a peak of 4 or less one event lands two steps
 * from empty. Quantiles would invent a pattern in sparse data.
 */
export function stepOf(count: number, peak: number): number {
  if (count <= 0 || peak <= 0) return 0
  return Math.min(STEPS, Math.ceil((STEPS * count) / peak))
}

/** Every cell holding the peak, Monday first, then by hour. Ties all carry the dot. */
export function peakCells(counts: number[][]): Cell[] {
  const peak = peakOf(counts)
  if (peak <= 0) return []
  const cells: Cell[] = []
  counts.forEach((row, day) => row.forEach((c, hour) => c === peak && cells.push({ day, hour })))
  return cells
}

/** The footer's peak line: "Peak · Tue 14:00 · 38 reviews", ties as "Tue 14:00 and 2 more". */
export function peakLine(counts: number[][], unit: HeatmapUnit): string {
  const cells = peakCells(counts)
  const first = cells[0]
  if (!first) return ''
  const more = cells.length > 1 ? ` and ${cells.length - 1} more` : ''
  const peak = peakOf(counts)
  return `Peak · ${DAYS[first.day]!.short} ${timeLabel(first.hour)}${more} · ${peak} ${unitWord(unit, peak)}`
}

/** The cell's accessible name and the tooltip's fact: "Tuesday 14:00, 38 reviews". */
export function cellName(day: number, hour: number, count: number, unit: HeatmapUnit): string {
  return `${DAYS[day]!.long} ${timeLabel(hour)}, ${count} ${unitWord(unit, count)}`
}

/** Fills the model's cell pattern with the clicked cell's weekday and hour. */
export function fillAsk(pattern: string, day: number, hour: number): string {
  return pattern.replaceAll('{weekday}', DAYS[day]!.long).replaceAll('{hour}', timeLabel(hour))
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

/** The figures a sentence about a punch card may cite: cells, day and hour totals, the total, shares, the window. */
export function heatFacts(counts: number[][], weeks: number): number[] {
  const dayTotals = counts.map(sum)
  const hourTotals = Array.from({ length: HOURS }, (_, h) => sum(counts.map(row => row[h] ?? 0)))
  const total = sum(dayTotals)
  const weekend = (dayTotals[5] ?? 0) + (dayTotals[6] ?? 0)
  const shares = total > 0 ? [...dayTotals, ...hourTotals, weekend, total - weekend].map(v => v / total) : []
  return [...counts.flat(), ...dayTotals, ...hourTotals, total, weekend, total - weekend, weeks, ...shares]
}

// Clock times name an hour of the grid, not a count; they are checked as hours and then set aside.
const CLOCK = /\b(\d{1,2}):(\d{2})\b/g

/** The plot's label: the model's summary when its numbers match the counts, else the system's own sentence. */
export function heatmapLabel(props: Pick<HeatmapProps, 'summary' | 'counts' | 'unit' | 'window'>): string {
  const { summary, counts, unit, window } = props
  const weeks = WINDOW_LABELS[window].weeks
  const badClock = [...summary.matchAll(CLOCK)].some(([, h, m]) => Number(h) >= HOURS || m !== '00')
  const check = validateNumbers(summary.replace(CLOCK, t => ' '.repeat(t.length)), heatFacts(counts, weeks))
  if (check.ok && !badClock) return summary
  log.warn('heatmap summary did not match its counts', { mismatches: check.mismatches.map(m => m.raw), badClock })
  return systemSummary(counts, unit, window)
}

export function systemSummary(counts: number[][], unit: HeatmapUnit, window: HeatmapProps['window']): string {
  const words = UNIT_WORDS[unit].many
  const Words = words[0]!.toUpperCase() + words.slice(1)
  const cells = peakCells(counts)
  const first = cells[0]
  if (!first) return `No ${words} in the ${WINDOW_LABELS[window].words}.`
  const peak = peakOf(counts)
  const more = cells.length > 1 ? ` and ${cells.length - 1} more hours, ${peak} each,` : ` with ${peak}`
  return `${Words} peak ${DAYS[first.day]!.long} at ${timeLabel(first.hour)}${more} in the ${WINDOW_LABELS[window].words}.`
}
