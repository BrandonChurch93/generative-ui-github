import { z } from 'zod'
import type { ComponentSpec } from '../../registry'
import { emptyToneSchema } from '../../schema/shared'
import type { EmptyTone } from '../../types'
import { FILE_CAP, fileWords, formatWhole, type FileEntry } from './tree'

export const FILE_TREE_MODES = ['changes', 'overview'] as const
export type FileTreeMode = (typeof FILE_TREE_MODES)[number]

const pathSchema = z.string().min(1).max(300)

export const fileTreeSchema = z
  .object({
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
    mode: z.enum(FILE_TREE_MODES),
    pr: z.number().int().positive().optional(),
    path: pathSchema.optional(),
    title: z.string().min(1).max(48),
    selected: pathSchema.optional(),
    open: z.array(pathSchema).min(1).max(12).optional(),
    emptyTone: emptyToneSchema.optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.mode === 'changes' && p.pr === undefined) ctx.addIssue({ code: 'custom', path: ['pr'], message: 'changes mode names a pull request' })
    if (p.mode === 'changes' && p.path !== undefined) ctx.addIssue({ code: 'custom', path: ['path'], message: 'path is for overview mode' })
    if (p.mode === 'overview' && p.pr !== undefined) ctx.addIssue({ code: 'custom', path: ['pr'], message: 'pr is for changes mode' })
  })

export type FileTreeModelProps = z.infer<typeof fileTreeSchema>

/** What FileTree renders: the model's choices plus the files the system fetched. */
export interface FileTreeProps {
  repo: string
  mode: FileTreeMode
  pr?: number
  path?: string
  title: string
  /** The file the model is talking about. In a review screen, the file the DiffView shows. */
  selected?: string
  /** Folders to start open. Without it: all at 20 files or fewer, else the selected file's path. */
  open?: string[]
  emptyTone?: EmptyTone
  /** (system) The pull request's files, or every file under the overview root, as GitHub listed them. */
  files: FileEntry[]
  /** (system) How many files there really are, when GitHub's list or the 3,000 cap stopped short (the PR's `changed_files`). */
  total?: number
  /** (system) The pull request's own line totals, so the header stays true when the list was cut. */
  totals?: { additions: number; deletions: number }
  /** (system) Why nothing changed, under the empty sentence: "head matches canary · #84211". */
  emptyMeta?: string
}

/** The system's words. The model never writes any of them. */
export const WORDS = {
  empty: { changes: 'No files changed', overview: 'No files here' },
  failed: "Couldn't load files",
  /** When the list stopped at the cap: what is shown, how many there are, and why the rest are missing. */
  capped: (mode: FileTreeMode, shown: number, total: number) =>
    mode === 'changes'
      ? `First ${formatWhole(shown)} of ${fileWords(total)} · GitHub lists no more than ${formatWhole(FILE_CAP)}`
      : `First ${formatWhole(shown)} of ${fileWords(total)} · the tree stops at ${formatWhole(FILE_CAP)}`,
  additions: (n: number) => `${formatWhole(n)} ${n === 1 ? 'addition' : 'additions'}`,
  deletions: (n: number) => `${formatWhole(n)} ${n === 1 ? 'deletion' : 'deletions'}`,
} as const

export const fileTreeSpec: ComponentSpec<typeof fileTreeSchema> = {
  name: 'FileTree',
  schema: fileTreeSchema,
  when: 'Which areas a change touches, or how a folder is laid out.',
  heightClass: 'grows',
  pickable: true,
  statesOmitted: [
    { state: 'warming', reason: 'GitHub returns 202 only from its /stats endpoints; pull request files and git trees answer at once or fail.' },
  ],
  id: { key: p => (p.mode === 'changes' ? `changes:${p.pr}` : `overview:${p.path ?? 'root'}`) },
  example: {
    repo: 'vercel/next.js',
    mode: 'changes',
    pr: 84120,
    title: 'Files changed',
    selected: 'packages/next/src/server/app-render/get-css-inlined-link-tags.tsx',
  },
}
