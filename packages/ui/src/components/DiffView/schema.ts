import { z } from 'zod'
import type { FileChange } from '@genui-github/data'
import type { ComponentSpec } from '../../registry'
import { emptyToneSchema } from '../../schema/shared'
import type { EmptyTone } from '../../types'
import { DIFF_LIMIT } from './patch'

// `lead` (the hunk the model's sentence is about) is held until eval evidence asks for it (decisions 37).
export const diffViewSchema = z
  .object({
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/).max(100),
    pr: z.number().int().positive(),
    path: z.string().min(1).max(400),
    open: z.boolean().optional(),
    emptyTone: emptyToneSchema.optional(),
  })
  .strict()

export type DiffViewModelProps = z.infer<typeof diffViewSchema>

/** What DiffView renders: the model's choice of file plus GitHub's record of it, which the system fetches. */
export interface DiffViewProps {
  repo: string
  pr: number
  path: string
  /** Default true. False renders the header alone. */
  open?: boolean
  emptyTone?: EmptyTone
  /** GitHub's status for the file in this pull request. */
  status: FileChange['status']
  /** GitHub's counts for the file. The header shows them even when the lines are not shown. */
  additions: number
  deletions: number
  /** GitHub's unified patch, verbatim. Absent when GitHub omits it (lockfiles, generated files, binaries). */
  patch?: string
  /** The path before a rename or copy. */
  previousPath?: string
  /** The file on GitHub, for View on GitHub. Defaults to the pull request's files tab. */
  url?: string
  /** A second fact for the empty row, after what the file was, such as "14 lines, identical". */
  emptyMeta?: string
}

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const plural = (n: number, one: string, many: string) => `${whole.format(n)} ${n === 1 ? one : many}`

/** Every word DiffView shows that is not code or a path. The system writes them; the model never does. */
export const DIFF_WORDS = {
  added: 'added',
  removed: 'removed',
  counts: (add: number, del: number) => `${plural(add, 'addition', 'additions')}, ${plural(del, 'deletion', 'deletions')}`,
  caption: (name: string) => `Changes to ${name}`,
  columns: ['Old line', 'New line', 'Change', 'Code'] as const,
  scrolls: (name: string) => `${name}, scrolls sideways`,
  hidden: (lines: number, hunks: number) => `${plural(lines, 'more line', 'more lines')} hidden in ${plural(hunks, 'hunk', 'hunks')}`,
  showAll: 'Show all',
  tooLarge: 'Too large to show here',
  overLimit: (changed: number) => `${plural(changed, 'changed line', 'changed lines')} · the limit is ${whole.format(DIFF_LIMIT)}`,
  omitted: (changed: number) => `${plural(changed, 'changed line', 'changed lines')} · GitHub sends no lines for this file`,
  binary: 'No lines to show',
  binaryMeta: 'binary file · GitHub sends no lines',
  viewOnGitHub: 'View on GitHub',
  empty: {
    renamed: 'Renamed without changes',
    copied: 'Copied without changes',
    changed: 'Mode changed without line changes',
    added: 'Added as an empty file',
    removed: 'Removed an empty file',
    modified: 'No line changes',
    unchanged: 'No line changes',
  } satisfies Record<FileChange['status'], string>,
  was: (previous: string) => `was ${previous}`,
  failed: "Couldn't load this diff",
  tryAgain: 'Try again',
  loading: (name: string) => `Loading the diff for ${name}.`,
} as const

export function formatCount(n: number): string {
  return whole.format(n)
}

export const diffViewSpec: ComponentSpec<typeof diffViewSchema> = {
  name: 'DiffView',
  schema: diffViewSchema,
  when: 'The change itself, one file. For a question about one pull request.',
  heightClass: 'grows',
  pickable: true,
  statesOmitted: [
    {
      state: 'warming',
      reason: 'GitHub returns 202 only from its /stats endpoints; pull request files answer at once or fail.',
    },
  ],
  // The path is not in the key: a rewrite that points the DiffView at another file of the same PR morphs it.
  id: { key: p => `${p.repo}#${p.pr}` },
  example: { repo: 'vercel/next.js', pr: 71904, path: 'packages/next/src/server/app-render/get-css-inlined-link-tags.tsx' },
}
