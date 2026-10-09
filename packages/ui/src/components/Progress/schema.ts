import { z } from 'zod'
import { MEASURES, type MeasureId } from '@genui-github/data'
import type { ComponentSpec } from '../../registry'

/** Only a measure that is a part of a whole can fill a track. */
export const PROGRESS_MEASURES = (Object.keys(MEASURES) as MeasureId[]).filter(id => MEASURES[id].unit === 'count-of-total')

/** The system's word for the counted part, after its share: "30% open". A measure without one shows the share alone. */
export const SHARE_WORDS: Partial<Record<MeasureId, string>> = {
  'failing-checks': 'failing',
  'milestone-issues-open': 'open',
}

/** The empty line when the whole is zero; nothing set a total, so nothing can fill. */
export const PROGRESS_EMPTY = 'Nothing to count yet'

export const progressSchema = z
  .object({
    measure: z.enum(PROGRESS_MEASURES as [MeasureId, ...MeasureId[]]),
    label: z.string().min(1).max(28),
  })
  .strict()

export type ProgressModelProps = z.infer<typeof progressSchema>

/** What Progress renders: the model's measure and label plus the part and the whole the system read. */
export interface ProgressProps {
  measure: MeasureId
  label: string
  /** The part, from the measure. A zero is data: an empty track and the figure 0. */
  count: number
  /** The whole. Zero is the empty state. */
  total: number
  /** What the measure covers, in the system's words: "milestone v16.2 · due Oct 30". */
  meta?: string
  /** Empty state: what is missing, in the system's words. */
  message?: string
}

export const progressSpec: ComponentSpec<typeof progressSchema> = {
  name: 'Progress',
  schema: progressSchema,
  when: 'Part of a whole, like milestone completion.',
  heightClass: 'fixed',
  pickable: true,
  statesOmitted: [
    {
      state: 'warming',
      reason: 'Every count-of-total measure reads check runs or milestones, never a /stats endpoint, so it never waits on a 202.',
    },
  ],
  id: { key: p => p.measure },
  example: { measure: 'milestone-issues-open', label: 'Open on v16.2' },
}
