// GitHub's unified patch for one file, parsed into hunks and lines. Pure: the component and its motion both read it.

export type LineKind = 'context' | 'add' | 'del'

export interface DiffLine {
  kind: LineKind
  old?: number
  new?: number
  /** The code without git's sign column, leading whitespace kept so a copied selection keeps its indentation. */
  text: string
  /** Leading whitespace in columns, tabs at TAB_WIDTH: where a wrapped continuation hangs from. */
  indent: number
  /** Character ranges `[start, end)` of the changed words, on equal-length paired runs only. */
  marks?: [number, number][]
  /** Stable across pushes while the line's kind and text survive, so neighbors can move with Flip. */
  key: string
}

export interface Hunk {
  /** git's own `@@ -21,7 +22,7 @@ function` line, verbatim. */
  header: string
  lines: DiffLine[]
}

/** Past this many rendered lines, the lead hunk shows and the rest fold. */
export const FOLD_AT = 40
/** Past this many changed lines, a summary replaces the lines. */
export const DIFF_LIMIT = 1000
export const TAB_WIDTH = 4

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

function indentOf(text: string): number {
  let cols = 0
  for (const ch of text) {
    if (ch === ' ') cols += 1
    else if (ch === '\t') cols += TAB_WIDTH - (cols % TAB_WIDTH)
    else break
  }
  return cols
}

function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export function parsePatch(patch: string | undefined): Hunk[] {
  if (!patch) return []
  const hunks: Hunk[] = []
  const seen = new Map<string, number>()
  let current: Hunk | null = null
  let oldNo = 0
  let newNo = 0
  let oldLeft = 0
  let newLeft = 0

  for (const raw of patch.split(/\r?\n/)) {
    const head = HUNK.exec(raw)
    if (head) {
      oldNo = Number(head[1])
      newNo = Number(head[3])
      oldLeft = head[2] === undefined ? 1 : Number(head[2])
      newLeft = head[4] === undefined ? 1 : Number(head[4])
      current = { header: raw, lines: [] }
      hunks.push(current)
      continue
    }
    // Counts from the hunk header decide where a hunk ends, so a trailing newline is never read as a blank line.
    if (!current || (oldLeft <= 0 && newLeft <= 0)) continue
    if (raw.startsWith('\\')) continue
    const sign = raw[0]
    const kind: LineKind = sign === '+' ? 'add' : sign === '-' ? 'del' : 'context'
    const text = sign === '+' || sign === '-' || sign === ' ' ? raw.slice(1) : raw
    const id = `${kind}:${hash(text)}`
    const n = (seen.get(id) ?? 0) + 1
    seen.set(id, n)
    const line: DiffLine = { kind, text, indent: indentOf(text), key: `${id}:${n}` }
    if (kind !== 'add') {
      line.old = oldNo++
      oldLeft--
    }
    if (kind !== 'del') {
      line.new = newNo++
      newLeft--
    }
    current.lines.push(line)
  }

  for (const hunk of hunks) markWords(hunk.lines)
  return hunks
}

// Words, runs of whitespace, and single punctuation marks, so `.copied()` changes only at `copied`.
const TOKEN = /\w+|\s+|[^\w\s]/g
const MAX_TOKENS = 400

function changedTokens(a: string[], b: string[]): [boolean[], boolean[]] {
  const cols = b.length + 1
  const lcs = new Uint16Array((a.length + 1) * cols)
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      lcs[i * cols + j] = a[i - 1] === b[j - 1] ? lcs[(i - 1) * cols + j - 1]! + 1 : Math.max(lcs[(i - 1) * cols + j]!, lcs[i * cols + j - 1]!)
    }
  }
  const aChanged = a.map(() => true)
  const bChanged = b.map(() => true)
  // Walking back from the end keeps a closing bracket with the code it closes: `f(x, y)` reads as `f(` and `, y)`.
  let i = a.length
  let j = b.length
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1] && lcs[i * cols + j] === lcs[(i - 1) * cols + j - 1]! + 1) {
      aChanged[--i] = false
      bChanged[--j] = false
    } else if (lcs[(i - 1) * cols + j]! >= lcs[i * cols + j - 1]!) i--
    else j--
  }
  return [aChanged, bChanged]
}

function rangesOf(tokens: string[], changed: boolean[]): [number, number][] {
  const ranges: [number, number][] = []
  let at = 0
  let open: [number, number] | null = null
  tokens.forEach((token, k) => {
    const blank = /^\s+$/.test(token)
    if (changed[k] && !blank) {
      if (open) open[1] = at + token.length
      else open = [at, at + token.length]
    } else if (!blank) {
      if (open) ranges.push(open)
      open = null
    }
    at += token.length
  })
  if (open) ranges.push(open)
  return ranges
}

const share = (ranges: [number, number][], text: string) =>
  text.length === 0 ? 1 : ranges.reduce((sum, [s, e]) => sum + e - s, 0) / text.length

/**
 * Marks the changed words where a removed block and the added block right after it have the same number of
 * lines. A pair where either line changed more than half its length keeps the line tint alone.
 */
export function markWords(lines: DiffLine[]): void {
  let i = 0
  while (i < lines.length) {
    if (lines[i]!.kind !== 'del') {
      i++
      continue
    }
    let d = i
    while (d < lines.length && lines[d]!.kind === 'del') d++
    let a = d
    while (a < lines.length && lines[a]!.kind === 'add') a++
    const dels = lines.slice(i, d)
    const adds = lines.slice(d, a)
    if (dels.length === adds.length) {
      dels.forEach((del, k) => {
        const add = adds[k]!
        const dt = del.text.match(TOKEN) ?? []
        const at = add.text.match(TOKEN) ?? []
        if (dt.length > MAX_TOKENS || at.length > MAX_TOKENS) return
        const [dc, ac] = changedTokens(dt, at)
        const dr = rangesOf(dt, dc)
        const ar = rangesOf(at, ac)
        if (share(dr, del.text) > 0.5 || share(ar, add.text) > 0.5) return
        if (dr.length) del.marks = dr
        if (ar.length) add.marks = ar
      })
    }
    i = Math.max(a, i + 1)
  }
}

export function lineCount(hunks: Hunk[]): number {
  return hunks.reduce((sum, h) => sum + h.lines.length, 0)
}

export interface Fold {
  /** Lines shown per hunk; 0 hides the hunk and its header. */
  shown: number[]
  hiddenLines: number
  hiddenHunks: number
}

/** The lead hunk (the first, while `lead` is held) shows up to FOLD_AT lines; everything after it folds. */
export function foldHunks(hunks: Hunk[]): Fold {
  const total = lineCount(hunks)
  if (total <= FOLD_AT) return { shown: hunks.map(h => h.lines.length), hiddenLines: 0, hiddenHunks: 0 }
  const shown = hunks.map((h, i) => (i === 0 ? Math.min(h.lines.length, FOLD_AT) : 0))
  const hiddenHunks = hunks.filter((h, i) => shown[i]! < h.lines.length).length
  return { shown, hiddenLines: total - shown[0]!, hiddenHunks }
}

/** Whitespace carries meaning in these files, so their lines scroll sideways instead of wrapping. */
export function wrapFor(path: string): 'wrap' | 'scroll' {
  const name = (path.split('/').pop() ?? path).toLowerCase()
  if (name === 'makefile' || name === 'gnumakefile') return 'scroll'
  const ext = name.includes('.') ? name.split('.').pop() : ''
  return ext && ['yml', 'yaml', 'py', 'pyi', 'pyw', 'mk'].includes(ext) ? 'scroll' : 'wrap'
}

export type DiffBody = 'lines' | 'empty' | 'limit' | 'omitted' | 'binary'

/** What the body shows, decided from GitHub's counts and whether it sent a patch. */
export function bodyFor(file: { additions: number; deletions: number; patch?: string; status: string }, hunks: Hunk[]): DiffBody {
  const changed = file.additions + file.deletions
  if (changed > DIFF_LIMIT) return 'limit'
  if (hunks.length) return 'lines'
  if (changed > 0) return 'omitted'
  // GitHub reports a changed binary as modified with no counts and no patch.
  return file.status === 'modified' && file.patch === undefined ? 'binary' : 'empty'
}
