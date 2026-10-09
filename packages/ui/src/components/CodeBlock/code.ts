// A file's text split into numbered lines. Pure: the component and its motion both read it.
// wrapFor and the indent measure mirror DiffView's patch.ts so the two code surfaces wrap alike.

export const TAB_WIDTH = 4

export interface CodeLine {
  n: number
  /** Verbatim, leading whitespace kept so a copied selection keeps its indentation. */
  text: string
  /** Leading whitespace in columns, tabs at TAB_WIDTH: where a wrapped continuation hangs from. */
  indent: number
  /** Stable across pushes while the line's text survives, so neighbors can move with Flip. */
  key: string
}

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

export function splitLines(text: string, start: number): CodeLine[] {
  if (!text) return []
  const raw = text.split(/\r?\n/)
  // A file's final newline ends its last line; it does not start another.
  if (raw.length > 1 && raw.at(-1) === '') raw.pop()
  const seen = new Map<string, number>()
  return raw.map((line, i) => {
    const id = hash(line)
    const n = (seen.get(id) ?? 0) + 1
    seen.set(id, n)
    return { n: start + i, text: line, indent: indentOf(line), key: `${id}:${n}` }
  })
}

/** Whitespace carries meaning in these files, so their lines scroll sideways instead of wrapping. */
export function wrapFor(path: string): 'wrap' | 'scroll' {
  const name = (path.split('/').pop() ?? path).toLowerCase()
  if (name === 'makefile' || name === 'gnumakefile') return 'scroll'
  const ext = name.includes('.') ? name.split('.').pop() : ''
  return ext && ['yml', 'yaml', 'py', 'pyi', 'pyw', 'mk'].includes(ext) ? 'scroll' : 'wrap'
}

export function splitPath(path: string): { dir: string; name: string } {
  const at = path.lastIndexOf('/')
  return at < 0 ? { dir: '', name: path } : { dir: path.slice(0, at + 1), name: path.slice(at + 1) }
}
