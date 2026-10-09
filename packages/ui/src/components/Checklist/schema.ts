import { z } from 'zod'
import type { ComponentSpec } from '../../registry'

export const CHECKLIST_SOURCES = ['community-standards', 'milestone', 'release-checklist'] as const
export type ChecklistSource = (typeof CHECKLIST_SOURCES)[number]

/**
 * The system writes every word around a check: the tag for a yes and a no, the ring's caption, and the
 * empty line. The model picks the source; the same answer always reads the same.
 */
export const CHECK_WORDS: Record<ChecklistSource, { yes: string; no: string; caption: string; empty: string }> = {
  'community-standards': { yes: 'present', no: 'missing', caption: 'standards in place', empty: 'No community profile for this repo' },
  milestone: { yes: 'closed', no: 'open', caption: 'items closed', empty: 'Nothing on this milestone yet' },
  'release-checklist': { yes: 'done', no: 'to do', caption: 'steps done', empty: 'No release checklist found' },
}

export const checklistSchema = z
  .object({
    title: z.string().min(1).max(48),
    source: z.enum(CHECKLIST_SOURCES),
  })
  .strict()

export type ChecklistModelProps = z.infer<typeof checklistSchema>

export interface ChecklistItem {
  id: string
  /** The check, in the system's words: "Contributing guide". */
  title: string
  /** One line of evidence: the file found, or where it would go. */
  meta?: string
  passed: boolean
  /** With `onAsk`, the row is a button that asks this question. */
  ask?: string
  /** Otherwise, a link out (the file on GitHub). */
  url?: string
}

/** What Checklist renders: the model's title and source plus the checks the system read. The ring is their share passed. */
export interface ChecklistProps {
  title: string
  source: ChecklistSource
  /** The header's meta, written by the system: where the checks come from. */
  meta?: string
  items: ChecklistItem[]
  /** The system's second line under the empty sentence. */
  emptyMeta?: string
}

export const checklistSpec: ComponentSpec<typeof checklistSchema> = {
  name: 'Checklist',
  schema: checklistSchema,
  when: 'A set of yes/no checks, like community standards.',
  heightClass: 'fixed',
  pickable: true,
  statesOmitted: [
    {
      state: 'warming',
      reason: 'The community profile, milestones and releases are not /stats endpoints, so the checks never wait on a 202.',
    },
  ],
  id: { key: p => p.source },
  example: { title: 'Community standards', source: 'community-standards' },
}
