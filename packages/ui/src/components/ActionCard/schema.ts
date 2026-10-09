import { z } from 'zod'
import type { ComponentSpec } from '../../registry'
import { linkSchema, prose, type Link } from '../../schema/shared'

export const EFFECT_KINDS = ['comment', 'request-review', 'add-label', 'rerun-checks'] as const
export type EffectKind = (typeof EFFECT_KINDS)[number]

// Nothing that merges, closes or deletes is in the enum, so the card cannot propose an irreversible act.
export const effectSchema = z
  .object({
    kind: z.enum(EFFECT_KINDS),
    targets: z.array(z.string().min(1).max(64)).min(1).max(8),
  })
  .strict()
export type Effect = z.infer<typeof effectSchema>

export const actionCardSchema = z
  .object({
    heading: prose(48),
    body: prose(140),
    primary: z.string().min(1).max(28),
    secondary: linkSchema.optional(),
    effect: effectSchema,
  })
  .strict()

export type ActionCardModelProps = z.infer<typeof actionCardSchema>

export interface ActionCardProps {
  heading: string
  body: string
  primary: string
  secondary?: Link
  effect: Effect
  /** System. Always `sample` in v1: the flow runs on real reads and nothing is ever written. */
  mode: 'sample'
}

const NOUN: Record<EffectKind, [string, string]> = {
  comment: ['comment', 'comments'],
  'request-review': ['review request', 'review requests'],
  'add-label': ['label', 'labels'],
  'rerun-checks': ['re-run', 're-runs'],
}

const plural = (kind: EffectKind, n: number) => `${n} ${NOUN[kind][n === 1 ? 0 : 1]}`
const list = (targets: string[]) => targets.join(', ')

/** Every sentence the card says about its effect, written by code so the restatement cannot drift from what runs. */
export const effectWords = {
  question(effect: Effect): string {
    const n = effect.targets.length
    switch (effect.kind) {
      case 'comment':
        return `Post ${plural('comment', n)} on ${list(effect.targets)}?`
      case 'request-review':
        return `Request ${n === 1 ? 'a review' : `${n} reviews`} on ${list(effect.targets)}?`
      case 'add-label':
        return `Add a label to ${list(effect.targets)}?`
      case 'rerun-checks':
        return `Re-run ${n === 1 ? 'the check' : `${n} checks`} ${list(effect.targets)}?`
    }
  },
  would(effect: Effect): string {
    const verbs: Record<EffectKind, string> = {
      comment: 'would comment on',
      'request-review': 'would request review on',
      'add-label': 'would label',
      'rerun-checks': 'would re-run',
    }
    return `${verbs[effect.kind]} ${list(effect.targets)}`
  },
  working(effect: Effect, i: number): string {
    return `Drafting ${NOUN[effect.kind][0]} ${i} of ${effect.targets.length}`
  },
  done(effect: Effect): string {
    return `Drafted ${plural(effect.kind, effect.targets.length)}`
  },
  failed(effect: Effect): string {
    return `Couldn't draft the ${NOUN[effect.kind][1]}`
  },
  draft(effect: Effect, target: string): string {
    switch (effect.kind) {
      case 'comment':
        return `${target}: a short note asking the requested reviewer for a look.`
      case 'request-review':
        return `${target}: a review request to the suggested reviewer.`
      case 'add-label':
        return `${target}: the label the answer pointed to.`
      case 'rerun-checks':
        return `${target}: a re-run of the failed job.`
    }
  },
  confirmLine: 'drafts only, nothing is posted to GitHub',
  doneLine: 'nothing was posted to GitHub',
}

export const actionCardSpec: ComponentSpec<typeof actionCardSchema> = {
  name: 'ActionCard',
  schema: actionCardSchema,
  when: 'One small, undoable next step on data already on screen. At most one, always last. Leave it out when there is nothing worth doing.',
  heightClass: 'fixed',
  pickable: true,
  statesOmitted: [
    { state: 'empty', reason: 'With nothing worth doing the composer leaves the card out.' },
    { state: 'warming', reason: 'The card reads nothing from the stats endpoints, so it never waits on a 202.' },
  ],
  id: { key: p => `${p.effect.kind}:${[...p.effect.targets].sort().join('+')}` },
  example: {
    heading: 'Nudge the three waiting reviewers',
    body: 'Posts one comment on each pull request asking its requested reviewer for a look. Nothing merges.',
    primary: 'Nudge reviewers',
    secondary: { label: 'Open milestone', href: 'https://github.com/vercel/next.js/milestone/1' },
    effect: { kind: 'comment', targets: ['#84120', '#84077', '#84201'] },
  },
}
