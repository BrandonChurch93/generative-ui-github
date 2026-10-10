// Shared by every chart: the zero-based y scale, week bands and labels, and the value formats.

export interface Scale {
  max: number
  step: number
  ticks: number[]
}

/** Zero-based, four equal intervals, round ticks: the smallest of 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6 or 8 times a power of ten that fits. */
export function niceScale(dataMax: number, intervals = 4): Scale {
  const raw = Math.max(dataMax, 0) / intervals
  if (raw === 0) return { max: intervals, step: 1, ticks: Array.from({ length: intervals + 1 }, (_, i) => i) }
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(m => m * power).find(s => s >= raw - 1e-9)!
  const max = step * intervals
  return { max, step, ticks: Array.from({ length: intervals + 1 }, (_, i) => Math.round(i * step * 1e6) / 1e6) }
}

/** Each week owns an equal band and its point sits at the band's center, as a percent of the plot width. */
export const bandCenter = (i: number, n: number) => ((i + 0.5) / n) * 100

/**
 * Thins the week axis by counting back from the latest week, so the endpoint's week is always labeled:
 * every k weeks, the smallest k of 1, 2, 3, 4 or 6 that leaves `gapPx` between labels.
 */
export function labelEvery(bandPx: number, gapPx: number): number {
  return [1, 2, 3, 4, 6].find(k => k * bandPx >= gapPx) ?? 6
}

export const isLabeled = (i: number, n: number, every: number) => (n - 1 - i) % every === 0

const weekFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
export const weekLabel = (iso: string) => weekFormat.format(new Date(iso))

/** `ratio` is closed per opened and similar quotients, drawn with the Metric's own × so the two read alike. */
export type ChartUnit = 'min' | 'h' | 'd' | 'count' | 'percent' | 'ratio'

export const UNIT_WORDS: Record<ChartUnit, string> = { min: 'min', h: 'h', d: 'd', count: '', percent: '%', ratio: '×' }

const oneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

const fixedOne = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Counts are whole; a measure under 10 keeps its tenth ("8.0 h"), larger ones drop a trailing zero ("41 h"). */
export function formatChartValue(value: number, unit: ChartUnit): string {
  if (unit === 'count') return whole.format(value)
  return Math.abs(value) < 10 ? fixedOne.format(value) : oneDecimal.format(value)
}

export const formatTick = (value: number) => oneDecimal.format(value)

/** A polyline through the points that exist, in a 0 to 100 box; missing weeks break the line. */
export function linePath(points: readonly (number | null)[], max: number): string {
  const n = points.length
  let d = ''
  let pen = false
  points.forEach((p, i) => {
    if (p === null || p === undefined) {
      pen = false
      return
    }
    const x = bandCenter(i, n).toFixed(3)
    const y = (100 - (p / max) * 100).toFixed(3)
    d += `${pen ? 'L' : 'M'}${x} ${y} `
    pen = true
  })
  return d.trim()
}

export const yPercent = (value: number, max: number) => 100 - (value / max) * 100
