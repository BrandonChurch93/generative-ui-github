import { z } from 'zod'
import type { ComponentSpec } from '../../registry'
import { prose, toneSchema } from '../../schema/shared'
import type { Tone } from '../../types'

export const calloutSchema = z
  .object({
    tone: toneSchema,
    text: prose(160),
  })
  .strict()

export type CalloutModelProps = z.infer<typeof calloutSchema>

/** What Callout renders: the model's sentence and tone, plus the figures the system lets it cite. */
export interface CalloutProps {
  tone: Tone
  /** Backticks mark identifiers, which set in mono. */
  text: string
  /**
   * Supplied by the renderer from the data context: every figure the sentence may cite. Absent, the sentence
   * may cite none, so any figure in it is a miss and the system sentence takes its place.
   */
  numbers?: number[]
  /** Supplied by the system: what the sentence rests on, for the meta line, such as "from 2 failing checks · last 7 days". */
  meta?: string
}

/** Every word Callout shows that the model did not write. */
export const CALLOUT_WORDS = {
  /** Read before the sentence, so the tone the mark and rule carry by shape and color is also in words. */
  tone: {
    neutral: 'Note.',
    good: 'Good news.',
    warn: 'Worth a look.',
    crit: 'Blocking.',
  } satisfies Record<Tone, string>,
  mismatch: "The model's figure didn't match the data, so this note is not shown.",
  mismatchMeta: 'checked against the data on screen',
  failed: "Couldn't show this note",
  tryAgain: 'Try again',
  loading: 'Loading a note.',
} as const

export const calloutSpec: ComponentSpec<typeof calloutSchema> = {
  name: 'Callout',
  schema: calloutSchema,
  when: 'One sentence the reader must not miss. Rare.',
  heightClass: 'fixed',
  pickable: true,
  statesOmitted: [
    { state: 'empty', reason: 'The sentence is required: a callout with nothing to say is left out, never drawn blank.' },
    {
      state: 'warming',
      reason: 'It reads no stats of its own; its sentence is written after the data answered, so a 202 wait shows in the insight and WarmingUp.',
    },
  ],
  // At most one callout per tone in practice, so a rewrite that rewords it morphs in place instead of remounting.
  id: { key: p => p.tone },
  example: { tone: 'warn', text: '`canary` has not had a green run since the last merge, so nothing new can ship from it.' },
}
