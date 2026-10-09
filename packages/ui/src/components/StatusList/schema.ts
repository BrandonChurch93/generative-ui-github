import { z } from 'zod'
import type { ComponentSpec } from '../../registry'
import { emptyToneSchema, prose, windowSchema } from '../../schema/shared'
import type { EmptyTone } from '../../types'
import type { TagTone } from '../../parts/tones'

export const STATUS_KINDS = ['pull', 'issue', 'workflow', 'check'] as const
export type StatusKind = (typeof STATUS_KINDS)[number]

export const STATES_BY_KIND = {
  pull: ['pending', 'changes', 'failing', 'approved', 'draft'],
  issue: ['open', 'stale', 'good-first', 'assigned', 'closed'],
  workflow: ['passing', 'failing', 'flaky', 'queued', 'disabled'],
  check: ['passed', 'failed', 'timeout', 'running', 'skipped'],
} as const satisfies Record<StatusKind, readonly string[]>

export type StatusState<K extends StatusKind = StatusKind> = (typeof STATES_BY_KIND)[K][number]

/** The system writes every tag word. The model picks the state; the same state always reads the same. */
export const TAGS: { [K in StatusKind]: Record<StatusState<K>, { words: string; tone: TagTone }> } = {
  pull: {
    pending: { words: 'review pending', tone: 'warn' },
    changes: { words: 'changes requested', tone: 'crit' },
    failing: { words: 'checks failing', tone: 'crit' },
    approved: { words: 'approved', tone: 'good' },
    draft: { words: 'draft', tone: 'quiet' },
  },
  issue: {
    open: { words: 'open', tone: 'quiet' },
    stale: { words: 'stale', tone: 'warn' },
    'good-first': { words: 'good first issue', tone: 'good' },
    assigned: { words: 'assigned', tone: 'quiet' },
    closed: { words: 'closed', tone: 'good' },
  },
  workflow: {
    passing: { words: 'passing', tone: 'good' },
    failing: { words: 'failing', tone: 'crit' },
    flaky: { words: 'flaky', tone: 'warn' },
    queued: { words: 'queued', tone: 'quiet' },
    disabled: { words: 'disabled', tone: 'quiet' },
  },
  check: {
    passed: { words: 'passed', tone: 'good' },
    failed: { words: 'failed', tone: 'crit' },
    timeout: { words: 'timed out', tone: 'warn' },
    running: { words: 'running', tone: 'quiet' },
    skipped: { words: 'skipped', tone: 'quiet' },
  },
}

export function tagFor(kind: StatusKind, state: string): { words: string; tone: TagTone } | undefined {
  return (TAGS[kind] as Record<string, { words: string; tone: TagTone }>)[state]
}

export const statusScopeSchema = z
  .object({
    milestone: z.string().min(1).max(40).optional(),
    branch: z.string().min(1).max(80).optional(),
    pr: z.number().int().positive().optional(),
    labels: z.array(z.string().min(1).max(40)).min(1).max(4).optional(),
    author: z.string().min(1).max(39).optional(),
    window: windowSchema.optional(),
  })
  .strict()
export type StatusScope = z.infer<typeof statusScopeSchema>

export const statusListSchema = z
  .object({
    kind: z.enum(STATUS_KINDS),
    title: z.string().min(1).max(48),
    meta: z.string().min(1).max(40).optional(),
    scope: statusScopeSchema.optional(),
    sort: z.enum(['wait', 'age', 'activity', 'size', 'duration']).optional(),
    limit: z.number().int().min(3).max(8).optional(),
    emptyTone: emptyToneSchema.optional(),
    empty: prose(60).optional(),
  })
  .strict()

export type StatusListModelProps = z.infer<typeof statusListSchema>

export interface StatusValue {
  pull: { add: number; del: number }
  issue: { comments: number }
  workflow: { p50Min: number; failRate: number }
  check: { durationMin: number }
}

export interface StatusItem<K extends StatusKind = StatusKind> {
  id: string
  title: string
  meta: string
  state: StatusState<K>
  value?: StatusValue[K]
  /** Twelve weekly points, workflow rows only. */
  trend?: number[]
  ask?: string
  url?: string
}

/** What StatusList renders: the model's choices plus the items the system fetched and sorted. */
export interface StatusListProps {
  kind: StatusKind
  title: string
  meta?: string
  emptyTone?: EmptyTone
  empty?: string
  items: StatusItem[]
  /** The system's second line under an empty sentence, such as "last merged 2h ago · #84112". */
  emptyMeta?: string
}

export function scopeKey(scope: StatusScope | undefined): string {
  if (!scope) return 'all'
  if (scope.milestone) return `milestone-${scope.milestone}`
  if (scope.pr) return `pr-${scope.pr}`
  if (scope.branch) return `branch-${scope.branch}`
  if (scope.author) return `author-${scope.author}`
  if (scope.labels) return `labels-${[...scope.labels].sort().join('+')}`
  return scope.window ?? 'all'
}

export const statusListSpec: ComponentSpec<typeof statusListSchema> = {
  name: 'StatusList',
  schema: statusListSchema,
  when: 'A titled list of things with a state each. Pick the kind that matches the data.',
  heightClass: 'grows',
  pickable: true,
  id: { key: p => `${p.kind}:${scopeKey(p.scope)}` },
  example: { kind: 'pull', title: 'Milestone pull requests', meta: 'sorted by wait', scope: { milestone: 'v16.2' }, sort: 'wait', limit: 5 },
}
