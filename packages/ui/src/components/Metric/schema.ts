import { z } from 'zod'
import { MEASURES, type MeasureId } from '@genui-github/data'
import type { ComponentSpec } from '../../registry'
import { measureIdSchema, prose, toneSchema, windowSchema, type Window } from '../../schema/shared'
import type { Tone } from '../../types'

export const metricSchema = z
  .object({
    measure: measureIdSchema,
    label: z.string().min(1).max(28).optional(),
    window: windowSchema.optional(),
    scope: z.string().min(1).max(40).optional(),
    delta: prose(32).optional(),
    deltaTone: toneSchema.optional(),
    hot: z.boolean().optional(),
    trend: z.boolean().optional(),
  })
  .strict()

export type MetricModelProps = z.infer<typeof metricSchema>

/** What Metric renders: the model's choices plus what the system binds from the measure. */
export interface MetricProps {
  measure: MeasureId
  label: string
  window?: Window
  scope?: string
  delta?: string
  deltaTone?: Tone
  hot?: boolean
  /** The figure as drawn. A number counts in; a string (clock, text) wipes in. */
  value: number | string
  suffix?: string
  format: 'count' | 'clock' | 'text'
  /** Bound when `trend` is set: 12 weekly points, oldest first, and the trend in words. */
  series?: { points: number[]; finding: string }
  /** Empty state: what is missing, in the system's words, and the window in words. */
  message?: string
  windowWords?: string
}

export const metricSpec: ComponentSpec<typeof metricSchema> = {
  name: 'Metric',
  schema: metricSchema,
  when: 'One number that answers part of the question. Hot means it is blocking.',
  heightClass: 'fixed',
  pickable: true,
  id: { key: p => (p.scope ? `${p.measure}:${p.scope}` : p.measure) },
  example: { measure: 'failing-checks', label: 'Failing checks', delta: 'both on canary', deltaTone: 'crit', hot: true },
}

export function defaultLabel(measure: MeasureId): string {
  return MEASURES[measure].label
}
