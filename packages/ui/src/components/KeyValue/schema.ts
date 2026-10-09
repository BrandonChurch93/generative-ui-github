import { z } from 'zod'
import type { ComponentSpec } from '../../registry'
import type { EmptyTone } from '../../types'

export const KEY_VALUE_SOURCES = ['repo', 'pr', 'release'] as const
export type KeyValueSource = (typeof KEY_VALUE_SOURCES)[number]

/** At most this many pairs render; the system fills no more. */
export const MAX_PAIRS = 8

/** Fixed wording for the frame and the states, per source. */
export const KEY_VALUE_COPY: Record<KeyValueSource, { title: string; loading: string; failed: string; empty: string }> = {
  repo: {
    title: 'About this repo',
    loading: 'repository facts',
    failed: "Couldn't load repository facts",
    empty: 'GitHub has no facts on this repo yet',
  },
  pr: {
    title: 'About this pull request',
    loading: 'pull request facts',
    failed: "Couldn't load pull request facts",
    empty: 'GitHub has no facts on this pull request yet',
  },
  release: {
    title: 'About this release',
    loading: 'release facts',
    failed: "Couldn't load release facts",
    empty: 'No releases published yet',
  },
}

export const keyValueSchema = z
  .object({
    source: z.enum(KEY_VALUE_SOURCES),
    /** Which pull request or which release tag. A repo needs no scope; a release without a tag is the latest. */
    scope: z
      .object({
        pr: z.number().int().positive().optional(),
        tag: z.string().min(1).max(80).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(p => p.source !== 'pr' || p.scope?.pr !== undefined, { message: 'A pr source names its pull request in scope.pr', path: ['scope', 'pr'] })

export type KeyValueModelProps = z.infer<typeof keyValueSchema>

export const VALUE_KINDS = ['text', 'identifier', 'count', 'time'] as const
export type ValueKind = (typeof VALUE_KINDS)[number]

export interface KeyValuePair {
  /** Stable across updates, such as "default-branch". */
  key: string
  /** Sentence case, written by the system: "Default branch". */
  label: string
  /** A count as a number; a time as an ISO string; anything else as the words to show. */
  value: string | number
  /** `identifier` sets the value in mono (branches, tags, handles, SHAs). Defaults to `text`. */
  kind?: ValueKind
}

/** What KeyValue renders: the model's source and scope, plus the pairs the system filled. */
export interface KeyValueProps {
  source: KeyValueSource
  /** (system) Names the thing, such as "vercel/next.js" or "Pull request #84120". Defaults to the source's title. */
  title?: string
  /** (system) A second fact for the header, such as "public · MIT". */
  meta?: string
  /** (system) At most 8, in reading order. */
  pairs: KeyValuePair[]
  /** (system) The clock relative times are written from. */
  now?: string
  /** (system) The empty sentence and its second line. */
  empty?: string
  emptyMeta?: string
  emptyTone?: EmptyTone
}

export const keyValueSpec: ComponentSpec<typeof keyValueSchema> = {
  name: 'KeyValue',
  schema: keyValueSchema,
  when: 'A few labeled facts about one thing.',
  heightClass: 'fixed',
  pickable: true,
  statesOmitted: [
    {
      state: 'warming',
      reason: 'Repository, pull request and release facts come from endpoints that answer at once or fail; only /stats returns 202.',
    },
  ],
  id: { key: p => (p.source === 'pr' ? `pr:${p.scope?.pr}` : p.source === 'release' ? `release:${p.scope?.tag ?? 'latest'}` : 'repo') },
  example: { source: 'pr', scope: { pr: 84120 } },
}
