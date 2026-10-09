import { z } from 'zod'
import type { ComponentSpec } from '../../registry'
import { prose } from '../../schema/shared'

const label = z.string().min(1).max(28)

/** Steps narrows the shared Link: its label is 28 characters at most, so it never wraps under the body. */
export const stepLinkSchema = z.union([
  z.object({ label, href: z.url() }).strict(),
  z.object({ label, ask: z.string().min(1).max(160) }).strict(),
])
export type StepLink = z.infer<typeof stepLinkSchema>

export const stepSchema = z
  .object({
    id: z.string().min(1).max(40),
    title: z.string().min(1).max(40),
    body: prose(140),
    fact: z.string().min(1).max(24).optional(),
    link: stepLinkSchema.optional(),
  })
  .strict()
export type Step = z.infer<typeof stepSchema>

export const stepsSchema = z
  .object({
    title: z.string().min(1).max(48),
    meta: z.string().min(1).max(40).optional(),
    steps: z.array(stepSchema).min(2).max(6),
  })
  .strict()

export type StepsModelProps = z.infer<typeof stepsSchema>

/**
 * What Steps renders. Every field is the model's: the system binds nothing, it only orders, numbers and clamps.
 * The composer has already checked each `fact` against the tool results and dropped any step that would read zero.
 */
export interface StepsProps {
  title: string
  /** A repo, branch or scope, right of the title. */
  meta?: string
  /** In the order the reader walks them. The first wears the accent. */
  steps: Step[]
}

/** Every word Steps writes itself. */
export const STEPS_WORDS = {
  loading: 'Writing the steps.',
  failed: "Couldn't write the steps",
  stepOf: (n: number, total: number) => `Step ${n} of ${total}. `,
  opensGitHub: '(opens GitHub)',
  opensTab: '(opens in a new tab)',
} as const

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export const stepsSpec: ComponentSpec<typeof stepsSchema> = {
  name: 'Steps',
  schema: stepsSchema,
  when: 'A sequence the reader walks in order. Fewer than two steps is an Insight.',
  heightClass: 'grows',
  pickable: true,
  statesOmitted: [
    {
      state: 'empty',
      reason: 'The model writes the steps, so nothing fetched comes back empty; with fewer than two the composer writes an Insight.',
    },
  ],
  // Steps cite no measure, so the card's own title is its key: "Where to start" morphs into itself across rewrites.
  id: { key: p => slug(p.title) },
  example: {
    title: 'Where to start',
    meta: 'vercel/next.js',
    steps: [
      { id: 'guide', title: 'Read the contributing guide', body: 'It covers the canary branch and what reviewers check.', link: { label: 'Contributing guide', href: 'https://github.com/vercel/next.js/blob/canary/contributing.md' } },
      { id: 'issue', title: 'Pick a good first issue', body: 'Each one is small and already triaged.', fact: '12 open', link: { label: 'Show the 12 issues', ask: 'Show the good first issues' } },
    ],
  },
}
