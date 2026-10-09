import { z } from 'zod'
import type { ComponentSpec } from '../../registry'
import { prose, toneSchema } from '../../schema/shared'
import type { Tone } from '../../types'

export const insightSourceSchema = z
  .object({
    key: z.string().min(1).max(64),
    ask: z.string().min(1).max(160).optional(),
  })
  .strict()

export const insightSchema = z
  .object({
    sentence: prose(120),
    sources: z.array(insightSourceSchema).min(1).max(4),
    tone: toneSchema.optional(),
  })
  .strict()

export type InsightModelProps = z.infer<typeof insightSchema>

/** What one cited data key contributes: the words for the source line and the numbers the sentence may use. */
export interface InsightSource {
  words: string
  numbers: number[]
}

export interface InsightProps {
  sentence: string
  sources: { key: string; ask?: string }[]
  tone?: Tone
  /** Supplied by the renderer from the data context (Phase 3). With it, the sentence's numbers are checked. */
  sourceMap?: Record<string, InsightSource>
  /** Facts after the sources on the source line, such as "last 7 days". */
  facts?: string[]
}

export const insightSpec: ComponentSpec<typeof insightSchema> = {
  name: 'Insight',
  schema: insightSchema,
  when: 'The one sentence that answers the question. Always first. Every number must come from the data.',
  heightClass: 'fixed',
  pickable: true,
  id: { key: () => 'answer' },
  example: {
    sentence: 'v16.2 is held by three pull requests waiting on review and two failing checks.',
    sources: [{ key: 'blockingPrs' }, { key: 'failing-checks', ask: 'Which checks are failing?' }],
    tone: 'warn',
  },
}
