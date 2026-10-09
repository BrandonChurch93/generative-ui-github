import { z } from 'zod'
import { MEASURE_IDS, type MeasureId } from '@genui-github/data'
import { DENSITIES, EMPHASES, TONES } from '../types'

// The shared enums from docs/schemas.md, as the model reads them.

export const densitySchema = z.enum(DENSITIES)
export const toneSchema = z.enum(TONES)
export const emphasisSchema = z.enum(EMPHASES)
export const emptyToneSchema = z.enum(['neutral', 'good'])
export const windowSchema = z.enum(['7d', '14d', '30d', '90d', '4w', '12w', '52w', 'week', 'month', 'milestone'])
export type Window = z.infer<typeof windowSchema>

export const askSchema = z.object({ label: z.string().min(1).max(40), ask: z.string().min(1).max(160) }).strict()
export type Ask = z.infer<typeof askSchema>

export const linkSchema = z.union([
  z.object({ label: z.string().min(1).max(40), href: z.url() }).strict(),
  z.object({ label: z.string().min(1).max(40), ask: z.string().min(1).max(160) }).strict(),
])
export type Link = z.infer<typeof linkSchema>

export const measureIdSchema = z.enum(MEASURE_IDS as [MeasureId, ...MeasureId[]])

/** A prose slot: the model's sentence, length-capped. Numbers in it are validated against the data it cites. */
export const prose = (max: number) => z.string().min(1).max(max)

/** How the system describes a window in words, for meta lines. */
export const WINDOW_WORDS: Record<Window, string> = {
  '7d': 'last 7 days',
  '14d': 'last 14 days',
  '30d': 'last 30 days',
  '90d': 'last 90 days',
  '4w': 'last 4 weeks',
  '12w': 'last 12 weeks',
  '52w': 'last 52 weeks',
  week: 'this week',
  month: 'this month',
  milestone: 'this milestone',
}
