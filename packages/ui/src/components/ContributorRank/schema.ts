import { z } from 'zod'
import type { ComponentSpec } from '../../registry'
import { emptyToneSchema, prose, WINDOW_WORDS } from '../../schema/shared'
import type { EmptyTone } from '../../types'

export const RANK_MEASURES = ['commits', 'reviews'] as const
export type RankMeasure = (typeof RANK_MEASURES)[number]

export const WALL_TONES = ['fact', 'risk'] as const
export type WallTone = (typeof WALL_TONES)[number]

/** The window is fixed by the data layer (docs/decisions.md, 45). */
export const RANK_WINDOW = '90d' as const
export const RANK_WINDOW_WORDS = WINDOW_WORDS[RANK_WINDOW]

/** The system writes every word about the measure. The model only picks which one. */
export const RANK_WORDS: Record<
  RankMeasure,
  {
    /** Band and row: "52% of merged commits", "268 merged commits". */
    unit: string
    unitOne: string
    /** The card's finding: "carry 61% of reviews on merged pull requests". */
    finding: string
    /** Header, foot and tooltip: "868 commits", "95 reviews". */
    short: string
    shortOne: string
    people: string
    person: string
    /** "Couldn't load commit authors", "Loading commit authors." */
    loading: string
    /** Table view column. */
    column: string
    ask: (handle: string) => string
  }
> = {
  commits: {
    unit: 'merged commits',
    unitOne: 'merged commit',
    finding: 'merged commits',
    short: 'commits',
    shortOne: 'commit',
    people: 'authors',
    person: 'author',
    loading: 'commit authors',
    column: 'Merged commits',
    ask: handle => `What is ${handle} working on?`,
  },
  reviews: {
    unit: 'reviews',
    unitOne: 'review',
    finding: 'reviews on merged pull requests',
    short: 'reviews',
    shortOne: 'review',
    people: 'reviewers',
    person: 'reviewer',
    loading: 'reviewers',
    column: 'Reviews',
    ask: handle => `What is ${handle} reviewing?`,
  },
}

/** Fixed wording the band and the states use. */
export const RANK_COPY = {
  risk: 'at risk',
  riskLead: 'At risk',
  warming: 'GitHub is counting contributors',
  empty: `Nothing in the ${RANK_WINDOW_WORDS}`,
  spreadLead: 'No small group carries half the work',
} as const

export const contributorRankSchema = z
  .object({
    title: z.string().min(1).max(48),
    meta: z.string().min(1).max(40).optional(),
    measure: z.enum(RANK_MEASURES),
    limit: z.number().int().min(3).max(8),
    wallTone: z.enum(WALL_TONES).optional(),
    emptyTone: emptyToneSchema.optional(),
    empty: prose(60).optional(),
  })
  .strict()

export type ContributorRankModelProps = z.infer<typeof contributorRankSchema>

/** One person as the data layer returns them: work in the window, never a share. */
export interface RankPerson {
  handle: string
  name?: string
  count: number
  /** ISO time of the person's latest work in the window. Breaks a tie at the wall toward the more recent. */
  lastActive?: string
  /** The tooltip's last line, written by the system: "last review 1d ago". */
  lastWords?: string
  /** A follow-up question; with `onAsk` the row is a button. The system writes it with `RANK_WORDS[measure].ask`. */
  ask?: string
}

/** What ContributorRank renders: the model's choices plus everyone the system found in the window. */
export interface ContributorRankProps {
  title: string
  meta?: string
  measure: RankMeasure
  /** Rows shown, 3 to 8. Shares are always of the window's whole total, not of the rows shown. */
  limit: number
  /** Defaults to `fact`. */
  wallTone?: WallTone
  emptyTone?: EmptyTone
  empty?: string
  /** (system) Everyone with work in the window, any order. The system sorts, shares, finds the wall and writes the band. */
  people: RankPerson[]
  /** (system) The second line under an empty sentence: "last merge 5 months ago · v3.4.17". */
  emptyMeta?: string
}

export const contributorRankSpec: ComponentSpec<typeof contributorRankSchema> = {
  name: 'ContributorRank',
  schema: contributorRankSchema,
  when: 'Who does the work and how concentrated it is. Shows bus factor.',
  heightClass: 'grows',
  pickable: true,
  id: { prefix: 'rank', key: p => `${p.measure}:${RANK_WINDOW}` },
  example: { title: 'Merged commits by author', measure: 'commits', limit: 5, wallTone: 'fact' },
}
