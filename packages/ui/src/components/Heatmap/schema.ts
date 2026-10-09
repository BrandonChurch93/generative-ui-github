import { z } from 'zod'
import type { ComponentSpec } from '../../registry'
import { emptyToneSchema, prose } from '../../schema/shared'
import type { EmptyTone } from '../../types'

export const HEATMAP_UNITS = ['commits', 'reviews', 'merges', 'comments'] as const
export type HeatmapUnit = (typeof HEATMAP_UNITS)[number]

export const HEATMAP_WINDOWS = ['4w', '12w', '52w'] as const
export type HeatmapWindow = (typeof HEATMAP_WINDOWS)[number]

export const heatmapSchema = z
  .object({
    title: z.string().min(1).max(48),
    unit: z.enum(HEATMAP_UNITS),
    window: z.enum(HEATMAP_WINDOWS),
    summary: prose(120),
    cellAsk: z
      .string()
      .min(1)
      .max(160)
      .refine(s => s.includes('{weekday}') || s.includes('{hour}'), 'cellAsk is a pattern with {weekday} and {hour}')
      .describe('The question a cell click asks, with {weekday} and {hour} for the system to fill.')
      .optional(),
    emptyTone: emptyToneSchema.optional(),
    empty: prose(60).optional(),
  })
  .strict()

export type HeatmapModelProps = z.infer<typeof heatmapSchema>

export interface HeatmapProps {
  title: string
  unit: HeatmapUnit
  window: HeatmapWindow
  /** The model's finding; it becomes the plot's label only when its numbers match the counts. */
  summary: string
  /** A pattern with `{weekday}` and `{hour}`; the system fills it from the clicked cell. */
  cellAsk?: string
  emptyTone?: EmptyTone
  empty?: string
  /** (system) 7 rows by 24 hours in the viewer's zone, Monday first (row 0 is Monday), repo wide. */
  counts: number[][]
  /** (system) The viewer's zone abbreviation for the header meta, e.g. "MDT". */
  zone: string
  /** (system) The empty row's meta line. */
  emptyMeta?: string
}

/** The system's words for each unit, one and many. */
export const UNIT_WORDS: Record<HeatmapUnit, { one: string; many: string }> = {
  commits: { one: 'commit', many: 'commits' },
  reviews: { one: 'review', many: 'reviews' },
  merges: { one: 'merge', many: 'merges' },
  comments: { one: 'comment', many: 'comments' },
}

export const WINDOW_LABELS: Record<HeatmapWindow, { words: string; weeks: number }> = {
  '4w': { words: 'last 4 weeks', weeks: 4 },
  '12w': { words: 'last 12 weeks', weeks: 12 },
  '52w': { words: 'last 52 weeks', weeks: 52 },
}

export const DAYS = [
  { short: 'Mon', long: 'Monday' },
  { short: 'Tue', long: 'Tuesday' },
  { short: 'Wed', long: 'Wednesday' },
  { short: 'Thu', long: 'Thursday' },
  { short: 'Fri', long: 'Friday' },
  { short: 'Sat', long: 'Saturday' },
  { short: 'Sun', long: 'Sunday' },
] as const

export const heatmapSpec: ComponentSpec<typeof heatmapSchema> = {
  name: 'Heatmap',
  schema: heatmapSchema,
  when: 'When things happen by weekday and hour. Repo wide.',
  heightClass: 'plot',
  pickable: true,
  // One punch card per screen; a rewrite from reviews to commits or 12 weeks to 4 morphs the same card.
  id: { key: () => 'punch-card' },
  example: {
    title: 'When reviews happen',
    unit: 'reviews',
    window: '12w',
    summary: 'Reviews peak Tuesday at 14:00 and thin out after 19:00 and on weekends.',
    cellAsk: 'What was reviewed on {weekday}s around {hour}?',
  },
}
