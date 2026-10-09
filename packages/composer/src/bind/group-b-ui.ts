import type { ShapeName } from '@genui-github/data'
import { WINDOW_WORDS as SHARED_WINDOW_WORDS, type LineChart } from '@genui-github/ui/schemas'
import type { DataContext } from './types'

// Shared by group B's binders. The model and bound types come from `@genui-github/ui/schemas`; the chart
// helpers below live in React modules that entry leaves out, so they are copied. Each names the file it
// mirrors; a change there must be made here too. The tests render every bound piece with the real component
// and assert its label is the finding, so a drift fails a test.

export const NOT_IN_DATA = "Not in this answer's data"

/** The shared window words, plus the 26 weeks only LineChart offers. */
export const WINDOW_WORDS = { ...SHARED_WINDOW_WORDS, '26w': 'last 26 weeks' } as const

// Charts · packages/ui/src/charts/scale.ts

export type ChartUnit = LineChart.LineChartProps['unit']

const oneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const fixedOne = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** `formatChartValue`: counts whole, a value under 10 keeps its tenth, larger ones drop a trailing zero. */
export function formatChartValue(value: number, unit: ChartUnit | 'ratio'): string {
  if (unit === 'count') return whole.format(value)
  return Math.abs(value) < 10 ? fixedOne.format(value) : oneDecimal.format(value)
}

/** packages/ui/src/components/BarChart/BarChart.tsx `barFacts` */
export function barFacts(values: readonly number[]): number[] {
  if (!values.length) return [0]
  const total = values.reduce((a, b) => a + b, 0)
  const facts = [...values, values.length, total, Math.max(...values) - Math.min(...values)]
  if (total > 0) facts.push(...values.map(v => (v / total) * 100))
  return facts
}

// Shared by the group's binders.

const STAT_IDS: Partial<Record<ShapeName, { id: string; words: string }>> = {
  'stats.contributors': { id: 'contributors', words: 'contributors' },
  'stats.punchCard': { id: 'punch_card', words: 'commits by hour' },
  'stats.commitActivity': { id: 'commit_activity', words: 'commit activity' },
  'stats.participation': { id: 'participation', words: 'participation' },
  'stats.codeFrequency': { id: 'code_frequency', words: 'code frequency' },
}

/** Why a shape the piece needs is not in the context, in the system's words. */
export function missingCause(ctx: DataContext, shapes: readonly ShapeName[]): string {
  for (const shape of shapes) {
    if (ctx.shapes[shape]) continue
    const stat = STAT_IDS[shape]
    if (!stat) continue
    if (ctx.warming?.stats.some(s => s.id === stat.id && s.state === 'counting')) return `GitHub is still counting ${stat.words}`
    if (ctx.unavailable.includes(shape)) return `GitHub does not count ${stat.words} for this repo`
  }
  return NOT_IN_DATA
}

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** "5h ago", "3d ago", for a tooltip's last line. */
export function agoWords(at: number, now: number): string {
  const ms = Math.max(0, now - at)
  if (ms < HOUR) return 'under 1h ago'
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h ago`
  return `${Math.floor(ms / DAY)}d ago`
}

const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
export const dateWords = (at: number) => shortDate.format(new Date(at))

export const round1 = (v: number) => Math.round(v * 10) / 10
/** Sentence case into mid-sentence, leaving an acronym ("CI run at p90") alone. */
export const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s)
export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
