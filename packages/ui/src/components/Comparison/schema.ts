import { z } from 'zod'
import { MEASURE_IDS, MEASURES, type MeasureId } from '@genui-github/data'
import type { ComponentSpec } from '../../registry'
import { emptyToneSchema, prose } from '../../schema/shared'
import type { EmptyTone } from '../../types'

// A clock or a weekday has no size, so it has no bar and no change.
const COMPARABLE = MEASURE_IDS.filter(id => MEASURES[id].unit !== 'clock' && MEASURES[id].unit !== 'text')

export const DIRECTIONS = ['lower-is-better', 'higher-is-better', 'neutral'] as const
export type Direction = (typeof DIRECTIONS)[number]

export const comparisonSchema = z
  .object({
    title: z.string().min(1).max(48),
    window: z.enum(['week', 'month', '30d', 'milestone']),
    pairs: z
      .array(
        z
          .object({
            measure: z.enum(COMPARABLE as [MeasureId, ...MeasureId[]]),
            direction: z.enum(DIRECTIONS),
            notable: z.boolean().optional(),
            ask: z.string().min(1).max(160).optional(),
          })
          .strict(),
      )
      .min(2)
      .max(4)
      .refine(pairs => new Set(pairs.map(p => p.measure)).size === pairs.length, 'Each measure appears once'),
    finding: prose(90),
    emptyTone: emptyToneSchema.optional(),
  })
  .strict()

export type ComparisonModelProps = z.infer<typeof comparisonSchema>
export type ComparisonWindow = ComparisonModelProps['window']

/** How a pair's values print. The system maps count-of-total and runs to `count`. */
export type PairUnit = 'count' | 'h' | 'd' | 'min' | 'percent' | 'ratio'

export interface ComparisonPair {
  measure: MeasureId
  direction: Direction
  notable?: boolean
  ask?: string
  /** System: the measure's short name, at most 24 characters. */
  name: string
  /** System: the meta line under the name ("time to first review"). */
  meta?: string
  /** System: from the measure. */
  unit: PairUnit
  /** System: the value in the current window. A rate is in percent (4.1 means 4.1%). */
  current: number
  /** System: the value in the window before it, same unit. */
  previous: number
  /** System: words after each value, for a pair that carries a second figure ("pass · 0.75 mean F1"). */
  note?: { current: string; previous: string }
}

/** System: the two windows in words. Long for the legend and the row sentence, short for the tooltip. */
export interface ComparisonPeriods {
  current: string
  previous: string
  currentShort: string
  previousShort: string
}

/** What Comparison renders: the model's choices plus both windows' values the system read. */
export interface ComparisonProps {
  title: string
  window: ComparisonWindow
  pairs: ComparisonPair[]
  finding: string
  emptyTone?: EmptyTone
  periods: ComparisonPeriods
  /** System: the footer's source line ("from 214 merged PRs · 3,480 check runs"). Always present. */
  source: string
  /** System: the empty row, what is missing and why ("a median needs at least one review"). */
  empty?: string
  emptyMeta?: string
}

export const VERDICTS = ['better', 'worse', 'steady', 'higher', 'lower', 'no change'] as const
export type Verdict = (typeof VERDICTS)[number]

export const VERDICT_TONE: Record<Verdict, 'good' | 'crit' | 'muted'> = {
  better: 'good',
  worse: 'crit',
  steady: 'muted',
  higher: 'muted',
  lower: 'muted',
  'no change': 'muted',
}

export const COMPARISON_WORDS = {
  loading: 'Loading the comparison.',
  empty: 'Nothing to compare in either window',
  versus: (p: ComparisonPeriods) => `${p.current} vs ${p.previous}`,
} as const

export const comparisonSpec: ComponentSpec<typeof comparisonSchema> = {
  name: 'Comparison',
  schema: comparisonSchema,
  when: 'This period against the last one, two to four measures.',
  heightClass: 'fixed',
  pickable: true,
  // The window and the lead measure, so a pair joining or leaving morphs the same card.
  id: { key: p => `${p.window}:${p.pairs[0]!.measure}` },
  example: {
    title: 'Review and CI health',
    window: 'month',
    pairs: [
      { measure: 'review-wait-median', direction: 'lower-is-better', notable: true },
      { measure: 'failing-check-rate', direction: 'lower-is-better', notable: true },
    ],
    finding: 'Review wait rose 38% while failing checks fell 2.2 points',
  },
}
