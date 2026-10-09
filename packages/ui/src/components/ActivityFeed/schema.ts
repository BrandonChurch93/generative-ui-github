import { z } from 'zod'
import type { ComponentSpec } from '../../registry'
import type { EmptyTone } from '../../types'
import { scopeKey, statusScopeSchema } from '../StatusList/schema'

export const ACTIVITY_VERBS = [
  'opened',
  'merged',
  'closed',
  'reopened',
  'commented',
  'reviewed',
  'approved',
  'changes',
  'pushed',
  'released',
] as const
export type ActivityVerb = (typeof ACTIVITY_VERBS)[number]

/** The system writes every verb. The data layer names the event; the same event always reads the same. */
export const VERB_WORDS: Record<ActivityVerb, string> = {
  opened: 'opened',
  merged: 'merged',
  closed: 'closed',
  reopened: 'reopened',
  commented: 'commented on',
  reviewed: 'reviewed',
  approved: 'approved',
  changes: 'requested changes on',
  pushed: 'pushed to',
  released: 'released',
}

export const ACTIVITY_OBJECT_KINDS = ['pull', 'issue', 'commit', 'branch', 'release'] as const
export type ActivityObjectKind = (typeof ACTIVITY_OBJECT_KINDS)[number]

/** Fixed wording for the frame and the states. */
export const ACTIVITY_COPY = {
  title: 'Recent activity',
  empty: 'Nothing happened in this window',
  failed: "Couldn't load recent activity",
  loading: 'recent activity',
} as const

/** The system shows this many events when the model names no limit. */
export const DEFAULT_ACTIVITY_LIMIT = 6

export const activityFeedSchema = z
  .object({
    scope: statusScopeSchema.optional(),
    limit: z.number().int().min(3).max(10).optional(),
  })
  .strict()

export type ActivityFeedModelProps = z.infer<typeof activityFeedSchema>

export interface ActivityObject {
  kind: ActivityObjectKind
  /** As the reader sees it: "#84112", "v16.2.0", "a1b2c3d", "canary". */
  ref: string
  /** The pull request or issue title, the commit's first line, the release name, the branch name. */
  title: string
}

export interface ActivityEvent {
  id: string
  /** A GitHub handle. */
  actor: string
  verb: ActivityVerb
  object: ActivityObject
  /** ISO time of the event. */
  when: string
  url?: string
  ask?: string
}

/** What ActivityFeed renders: the model's scope and limit, plus the events the system fetched. */
export interface ActivityFeedProps {
  /** (system) Defaults to "Recent activity"; the system may name the scope ("Activity on v16.2"). */
  title?: string
  /** (system) The window or the scope in words, such as "last 7 days". */
  meta?: string
  /** (system) Newest first, already cut to the model's limit. */
  items: ActivityEvent[]
  /** (system) The system's clock, so relative times are written once and stay put. */
  now: string
  /** (system) The empty sentence and its second line, written from the scope. */
  empty?: string
  emptyMeta?: string
  emptyTone?: EmptyTone
}

export const activityFeedSpec: ComponentSpec<typeof activityFeedSchema> = {
  name: 'ActivityFeed',
  schema: activityFeedSchema,
  when: 'A stream of recent events with actors.',
  heightClass: 'grows',
  pickable: true,
  statesOmitted: [
    {
      state: 'warming',
      reason: 'Events come from the events, pulls, issues and releases endpoints, which answer at once or fail; only /stats returns 202.',
    },
  ],
  id: { key: p => scopeKey(p.scope) },
  example: { scope: { window: '7d' }, limit: 6 },
}
