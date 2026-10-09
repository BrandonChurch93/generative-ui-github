import { z } from 'zod'
import type { ComponentSpec } from '../../registry'
import type { ChartUnit } from '../../charts/scale'
import { measureIdSchema, prose } from '../../schema/shared'
import type { EmptyTone } from '../../types'

export const BAR_BY = ['workflow', 'label', 'author', 'area'] as const
export type BarBy = (typeof BAR_BY)[number]

/** More categories than this and the bars stop being comparable at a glance; the system keeps the largest. */
export const MAX_BARS = 12

/** The system's words for each grouping: the table's first column and the plural in its own summary. */
export const BY_WORDS: Record<BarBy, { column: string; plural: string }> = {
  workflow: { column: 'Workflow', plural: 'workflows' },
  label: { column: 'Label', plural: 'labels' },
  author: { column: 'Author', plural: 'authors' },
  area: { column: 'Area', plural: 'areas' },
}

/** The empty line when the system binds none of its own; the model writes no empty sentence for this piece. */
export const BAR_EMPTY = 'Nothing to compare yet'

export const barChartSchema = z
  .object({
    title: z.string().min(1).max(48),
    meta: z.string().min(1).max(40).optional(),
    measure: measureIdSchema,
    by: z.enum(BAR_BY),
    finding: prose(120),
  })
  .strict()

export type BarChartModelProps = z.infer<typeof barChartSchema>

export interface BarDatum {
  /** The category's stable key: a workflow file, a label name, a handle, a path. */
  key: string
  /** What sits under the bar. */
  label: string
  value: number
}

/** What BarChart renders: the model's title, meta and finding plus the bars the system grouped and sorted. */
export interface BarChartProps {
  title: string
  meta?: string
  by: BarBy
  /** From the measure. */
  unit: ChartUnit
  /** At most 12, largest first, as the system sorted them. A zero is a bar on the baseline, not a missing one. */
  bars: BarDatum[]
  finding: string
  /** Empty state, written by the system from the measure: good when no bars means nothing is wrong. */
  emptyTone?: EmptyTone
  empty?: string
  emptyMeta?: string
}

export const barChartSpec: ComponentSpec<typeof barChartSchema> = {
  name: 'BarChart',
  schema: barChartSchema,
  when: 'One measure across a handful of categories.',
  heightClass: 'plot',
  pickable: true,
  id: { key: p => `${p.measure}:${p.by}` },
  example: {
    title: 'Stale issues by label',
    meta: 'no activity in 30 days',
    measure: 'stale-issues',
    by: 'label',
    finding: 'Bug reports hold 23 of the 61 stale issues, more than any other label.',
  },
}
