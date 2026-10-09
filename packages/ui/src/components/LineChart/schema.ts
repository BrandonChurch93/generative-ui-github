import { z } from 'zod'
import type { ComponentSpec } from '../../registry'
import type { ChartUnit } from '../../charts/scale'
import { emptyToneSchema, measureIdSchema, prose } from '../../schema/shared'
import type { EmptyTone } from '../../types'

export const lineChartSchema = z
  .object({
    title: z.string().min(1).max(48),
    meta: z.string().min(1).max(40).optional(),
    series: z
      .array(
        z
          .object({
            measure: measureIdSchema,
            name: z.string().min(1).max(28),
            scope: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(2),
    failures: z.boolean().optional(),
    window: z.enum(['12w', '26w', '52w']).optional(),
    finding: prose(120),
    emptyTone: emptyToneSchema.optional(),
    empty: prose(60).optional(),
  })
  .strict()

export type LineChartModelProps = z.infer<typeof lineChartSchema>

export interface LineChartProps {
  title: string
  meta?: string
  unit: ChartUnit
  /** ISO week starts, oldest first. */
  weeks: string[]
  /** One or two; the first is the series the story is about. Points line up with `weeks`; null is a missing week. */
  series: { name: string; points: (number | null)[] }[]
  /** Failed runs per week, same weeks. Present when the model asked for the strip. */
  failures?: number[]
  finding: string
  emptyTone?: EmptyTone
  empty?: string
  emptyMeta?: string
}

export const lineChartSpec: ComponentSpec<typeof lineChartSchema> = {
  name: 'LineChart',
  schema: lineChartSchema,
  when: 'A quantity over time, one or two series. Failure counts go in the strip, not a series.',
  heightClass: 'plot',
  pickable: true,
  id: { key: p => p.series.map(s => s.measure).join('+') },
  example: {
    title: 'CI duration',
    meta: 'p50 · last 12 weeks',
    series: [{ measure: 'ci-p50', name: 'Duration' }],
    failures: true,
    window: '12w',
    finding: 'CI got 39% slower in 12 weeks: the median run went from 13.2 to 18.4 minutes.',
  },
}
