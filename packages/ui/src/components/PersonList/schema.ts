import { z } from 'zod'
import type { ComponentSpec } from '../../registry'
import type { EmptyTone } from '../../types'

export const PERSON_MEASURES = ['commits', 'reviews', 'issues'] as const
export type PersonMeasure = (typeof PERSON_MEASURES)[number]

/** The system writes every word about the measure. The model only picks which one. */
export const PERSON_WORDS: Record<
  PersonMeasure,
  {
    /** The card's default title. */
    title: string
    one: string
    many: string
    /** "Loading commit authors.", "Couldn't load commit authors". */
    loading: string
    empty: string
    /** GitHub counts commits per author on /stats/contributors, which can answer 202. */
    warming?: string
    ask: (handle: string) => string
  }
> = {
  commits: {
    title: 'Most commits',
    one: 'commit',
    many: 'commits',
    loading: 'commit authors',
    empty: 'Nobody committed in this window',
    warming: 'GitHub is counting contributors',
    ask: handle => `What is ${handle} working on?`,
  },
  reviews: {
    title: 'Most reviews',
    one: 'review',
    many: 'reviews',
    loading: 'reviewers',
    empty: 'Nobody reviewed in this window',
    ask: handle => `What is ${handle} reviewing?`,
  },
  issues: {
    title: 'Most issues opened',
    one: 'issue',
    many: 'issues',
    loading: 'issue authors',
    empty: 'Nobody opened an issue in this window',
    ask: handle => `What issues has ${handle} opened?`,
  },
}

/** The system shows this many people when the model names no limit. */
export const DEFAULT_PERSON_LIMIT = 5

export const personListSchema = z
  .object({
    measure: z.enum(PERSON_MEASURES),
    limit: z.number().int().min(3).max(8).optional(),
  })
  .strict()

export type PersonListModelProps = z.infer<typeof personListSchema>

export interface ListedPerson {
  handle: string
  name?: string
  /** The one fact: the person's count of the measure in the window. Never zero; a person with no work is not listed. */
  count: number
  /** Written by the system with `PERSON_WORDS[measure].ask`; with `onAsk` the row is a button. */
  ask?: string
  /** Otherwise a link out to the person's profile. */
  url?: string
}

/** What PersonList renders: the model's measure and limit, plus the people the system fetched and sorted. */
export interface PersonListProps {
  measure: PersonMeasure
  /** Rows shown, 3 to 8. Defaults to 5. */
  limit?: number
  /** (system) Defaults to the measure's title, such as "Most commits"; the system may name the scope ("Who merged"). */
  title?: string
  /** (system) The window in words, such as "last 90 days". */
  meta?: string
  /** (system) Sorted by count, highest first. */
  people: ListedPerson[]
  /** (system) The empty sentence and its second line, written from the window. */
  empty?: string
  emptyMeta?: string
  emptyTone?: EmptyTone
}

export const personListSpec: ComponentSpec<typeof personListSchema> = {
  name: 'PersonList',
  schema: personListSchema,
  when: 'A short list of people with one fact each.',
  heightClass: 'grows',
  pickable: true,
  id: { key: p => p.measure },
  example: { measure: 'commits', limit: 5 },
}
