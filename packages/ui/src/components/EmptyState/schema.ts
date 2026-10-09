import { z } from 'zod'
import type { ComponentSpec } from '../../registry'
import { emptyToneSchema } from '../../schema/shared'

// System only: the shell builds this when a region has nothing, so the schema validates the system, not the model.
export const emptyStateSchema = z
  .object({
    /** What the region would have shown, so the reader knows what is missing. */
    title: z.string().min(1).max(60).optional(),
    meta: z.string().min(1).max(60).optional(),
    /** A real sentence: what is empty, in the reader's words. */
    sentence: z.string().min(1).max(120),
    /** The meta line under it: the scope looked at, or the last time there was something. */
    detail: z.string().min(1).max(80).optional(),
    /** `good` when nothing here means nothing is wrong; `neutral` when it means nothing to show yet. */
    emptyTone: emptyToneSchema.optional(),
  })
  .strict()

export type EmptyStateProps = z.infer<typeof emptyStateSchema>

const SYSTEM_ONLY = 'The system places EmptyState only once the data has answered with nothing'

export const emptyStateSpec: ComponentSpec<typeof emptyStateSchema> = {
  name: 'EmptyState',
  schema: emptyStateSchema,
  when: 'Used by the system when a region has nothing; not in the prompt.',
  heightClass: 'fixed',
  pickable: false,
  statesOmitted: [
    { state: 'skeleton', reason: `${SYSTEM_ONLY}; until then the region's own piece shows its skeleton.` },
    { state: 'empty', reason: 'It is the empty state: its default is the empty row, so a second empty would draw the same thing.' },
    { state: 'error', reason: `${SYSTEM_ONLY}; a failed read is the region piece's own error state.` },
    { state: 'warming', reason: `${SYSTEM_ONLY}; a 202 wait is WarmingUp's, and nothing is known to be empty until the stats land.` },
  ],
  id: { key: p => (p.title ?? p.sentence).toLowerCase() },
  example: { title: 'Failing checks', sentence: 'No failing checks on canary', detail: 'last 7 days · 214 runs', emptyTone: 'good' },
}
