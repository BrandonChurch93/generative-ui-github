import { z } from 'zod'
import type { ComponentSpec } from '../../registry'
import { emptyToneSchema, prose, windowSchema } from '../../schema/shared'
import type { EmptyTone } from '../../types'

export const timelineSchema = z
  .object({
    title: z.string().min(1).max(48),
    meta: z.string().min(1).max(40).optional(),
    kind: z.enum(['merged', 'commits']),
    scope: z
      .object({
        milestone: z.string().min(1).max(40).optional(),
        branch: z.string().min(1).max(80).optional(),
        base: z.string().min(1).max(80).optional(),
        head: z.string().min(1).max(80).optional(),
        author: z.string().min(1).max(39).optional(),
        window: windowSchema.optional(),
      })
      .strict()
      .optional(),
    limit: z.number().int().min(3).max(8).optional(),
    emptyTone: emptyToneSchema.optional(),
    empty: prose(60).optional(),
    dayAsk: z.string().min(1).max(160).includes('{day}').optional(),
  })
  .strict()

export type TimelineModelProps = z.infer<typeof timelineSchema>

export interface TimelineItem {
  /** A pull request number, or a short SHA for commits. */
  id: string
  title: string
  author: string
  /** ISO time of the merge or commit. */
  when: string
  add?: number
  del?: number
  /** The system's verb for the meta line: merged, committed, reverted. */
  verb?: string
  url: string
  ask?: string
}

export interface TimelineProps {
  title: string
  meta?: string
  kind: 'merged' | 'commits'
  emptyTone?: EmptyTone
  empty?: string
  dayAsk?: string
  /** Newest first. The system sorts; the component groups by day. */
  items: TimelineItem[]
  emptyMeta?: string
  /** The system's clock and the viewer's zone, so headings and relative times are written once and stay put. */
  now: string
  timeZone?: string
}

export const timelineSpec: ComponentSpec<typeof timelineSchema> = {
  name: 'Timeline',
  schema: timelineSchema,
  when: 'Things that happened in order, grouped by day.',
  heightClass: 'grows',
  pickable: true,
  id: {
    key: p => {
      const s = p.scope
      const scope = s?.milestone ? `milestone-${s.milestone}` : s?.base && s.head ? `${s.base}...${s.head}` : (s?.branch ?? s?.author ?? s?.window ?? 'all')
      return `${p.kind}:${scope}`
    },
  },
  example: { title: 'Merged into v16.2', meta: 'last 14 days', kind: 'merged', scope: { milestone: 'v16.2', window: '14d' }, limit: 6 },
}
