import { z } from 'zod'
import type { ComponentSpec } from '../../registry'

const lineNumber = z.number().int().positive()

export const codeBlockSchema = z
  .object({
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/).max(100),
    path: z.string().min(1).max(400),
    lines: z
      .tuple([lineNumber, lineNumber])
      .refine(([start, end]) => start <= end, { message: 'lines must run from start to end' })
      .optional(),
    caption: z.string().min(1).max(120).optional(),
  })
  .strict()

export type CodeBlockModelProps = z.infer<typeof codeBlockSchema>

/** What CodeBlock renders: the model's choice of file and lines plus the text, which the system fetches. */
export interface CodeBlockProps {
  repo: string
  path: string
  /** `[start, end]`, both inclusive. Absent, the whole file. */
  lines?: [number, number]
  caption?: string
  /** Supplied by the system: the file's text for those lines, verbatim. Empty when the file or the range has no lines. */
  text: string
  /** Supplied by the system: the number of the first line in `text`. Defaults to the range's start, or 1. */
  start?: number
  /** Supplied by the system: how many lines the whole file has, for the empty row. */
  fileLines?: number
  /** Supplied by the system: the commit the text was read at, so the link opens these exact lines. Defaults to HEAD. */
  ref?: string
  /** Supplied by the system: the file on GitHub at those lines. Defaults to a blob link built from repo, ref, path and lines. */
  url?: string
}

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const plural = (n: number, one: string, many: string) => `${whole.format(n)} ${n === 1 ? one : many}`

/** Past this many lines, the first FOLD_AT show and the rest fold behind Show all. */
export const FOLD_AT = 40
/** Past this many lines, Show all gives way to the file on GitHub. */
export const CODE_LIMIT = 1000

/** Every word CodeBlock shows that is not code or a path. The system writes them; the model never does. */
export const CODE_WORDS = {
  range: (start: number, end: number) => (start === end ? `line ${whole.format(start)}` : `lines ${whole.format(start)} to ${whole.format(end)}`),
  count: (n: number) => plural(n, 'line', 'lines'),
  caption: (name: string, range: string) => `${name}, ${range}`,
  columns: ['Line', 'Code'] as const,
  scrolls: (name: string) => `${name}, scrolls sideways`,
  hidden: (n: number) => `${plural(n, 'more line', 'more lines')} hidden`,
  overLimit: (n: number) => `${plural(n, 'more line', 'more lines')} · the limit here is ${whole.format(CODE_LIMIT)}`,
  showAll: 'Show all',
  viewOnGitHub: 'View on GitHub',
  emptyFile: 'This file is empty',
  pastEnd: (start: number, end: number) =>
    start === end
      ? `Line ${whole.format(start)} is past the end of the file`
      : `Lines ${whole.format(start)} to ${whole.format(end)} are past the end of the file`,
  emptyRange: 'No lines in this range',
  fileHas: (n: number) => `the file has ${plural(n, 'line', 'lines')}`,
  failed: (name: string) => `Couldn't load ${name}`,
  tryAgain: 'Try again',
  loading: (name: string) => `Loading ${name}.`,
} as const

/** The file on GitHub at the lines shown, pinned to the commit the text was read at. */
export function blobUrl(props: Pick<CodeBlockProps, 'repo' | 'path' | 'lines' | 'ref' | 'url'>): string {
  if (props.url) return props.url
  const path = props.path.split('/').map(encodeURIComponent).join('/')
  const anchor = props.lines ? (props.lines[0] === props.lines[1] ? `#L${props.lines[0]}` : `#L${props.lines[0]}-L${props.lines[1]}`) : ''
  return `https://github.com/${props.repo}/blob/${props.ref ?? 'HEAD'}/${path}${anchor}`
}

export const codeBlockSpec: ComponentSpec<typeof codeBlockSchema> = {
  name: 'CodeBlock',
  schema: codeBlockSchema,
  when: 'A snippet from the repo.',
  heightClass: 'grows',
  pickable: true,
  statesOmitted: [
    {
      state: 'warming',
      reason: 'GitHub returns 202 only from its /stats endpoints; file contents answer at once or fail.',
    },
  ],
  // The range is not in the key: a rewrite that shows other lines of the same file morphs it.
  id: { key: p => `${p.repo}/${p.path}` },
  example: { repo: 'vercel/next.js', path: 'packages/next/src/server/app-render/get-css-inlined-link-tags.tsx', lines: [8, 30] },
}
