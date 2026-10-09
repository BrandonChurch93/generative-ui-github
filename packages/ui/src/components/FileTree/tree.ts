// Paths to a tree: nesting, folder chains, rolled-up counts, which folders start open, middle truncation.
// Pure, so the component, the motion and the tests all read the same tree.

/** One file as the system bound it: a pull request file, or a file under an overview root. */
export interface FileEntry {
  path: string
  additions?: number
  deletions?: number
  /** The file's diff (an in-page anchor beside a DiffView) or the file on GitHub. */
  href?: string
  /** The follow-up a click on this file asks, when the screen can answer it (a DiffView swap). */
  ask?: string
}

export interface TreeFile {
  kind: 'file'
  path: string
  name: string
  /** The folder row this file sits under, or '' at the top. */
  parent: string
  depth: number
  additions: number
  deletions: number
  href?: string
  ask?: string
}

export interface TreeFolder {
  kind: 'folder'
  /** The deepest folder of a compressed chain: `packages/next/src/server/app-render`. */
  path: string
  /** What the row shows: the chain below its parent row, joined by `/`. */
  name: string
  parent: string
  depth: number
  children: TreeNode[]
  additions: number
  deletions: number
  files: number
}

export type TreeNode = TreeFile | TreeFolder

/** GitHub stops listing a pull request's files here; an overview stops at the same count. */
export const FILE_CAP = 3000
/** At or under this many files, every folder starts open (decision 38). */
export const OPEN_ALL_AT = 20

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
export const formatWhole = (n: number) => whole.format(n)
export const formatAdd = (n: number) => `+${whole.format(n)}`
// U+2212, so plus and minus stack at the same width.
export const formatDel = (n: number) => `−${whole.format(n)}`

export function capFiles(files: readonly FileEntry[], cap = FILE_CAP): { files: FileEntry[]; truncated: boolean } {
  return files.length > cap ? { files: files.slice(0, cap), truncated: true } : { files: [...files], truncated: false }
}

interface Raw {
  folders: Map<string, Raw>
  files: Map<string, FileEntry>
}

const byName = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true }) || (a < b ? -1 : a > b ? 1 : 0)

/** Folders first, then files, each alphabetical; a chain of single-folder folders folds into one row. */
export function buildTree(files: readonly FileEntry[]): TreeNode[] {
  const root: Raw = { folders: new Map(), files: new Map() }
  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean)
    const name = parts.pop()
    if (!name) continue
    let node = root
    for (const part of parts) {
      let next = node.folders.get(part)
      if (!next) {
        next = { folders: new Map(), files: new Map() }
        node.folders.set(part, next)
      }
      node = next
    }
    if (!node.files.has(name)) node.files.set(name, { ...file, path: [...parts, name].join('/') })
  }
  return convert(root, '', 0)
}

function convert(raw: Raw, parent: string, depth: number): TreeNode[] {
  const folders: TreeFolder[] = [...raw.folders.keys()].sort(byName).map(first => {
    let name = first
    let node = raw.folders.get(first)!
    while (node.files.size === 0 && node.folders.size === 1) {
      const [only, child] = [...node.folders][0]!
      name = `${name}/${only}`
      node = child
    }
    const path = parent ? `${parent}/${name}` : name
    const children = convert(node, path, depth + 1)
    let additions = 0
    let deletions = 0
    let count = 0
    for (const child of children) {
      additions += child.additions
      deletions += child.deletions
      count += child.kind === 'folder' ? child.files : 1
    }
    return { kind: 'folder', path, name, parent, depth, children, additions, deletions, files: count }
  })
  const leaves: TreeFile[] = [...raw.files.keys()].sort(byName).map(name => {
    const entry = raw.files.get(name)!
    return {
      kind: 'file',
      path: entry.path,
      name,
      parent,
      depth,
      additions: entry.additions ?? 0,
      deletions: entry.deletions ?? 0,
      href: entry.href,
      ask: entry.ask,
    }
  })
  return [...folders, ...leaves]
}

export function folders(nodes: readonly TreeNode[]): TreeFolder[] {
  const out: TreeFolder[] = []
  const walk = (list: readonly TreeNode[]) => {
    for (const node of list) {
      if (node.kind === 'folder') {
        out.push(node)
        walk(node.children)
      }
    }
  }
  walk(nodes)
  return out
}

export function findFile(nodes: readonly TreeNode[], path: string): TreeFile | undefined {
  for (const node of nodes) {
    if (node.kind === 'file' && node.path === path) return node
    if (node.kind === 'folder' && path.startsWith(`${node.path}/`)) return findFile(node.children, path)
  }
  return undefined
}

const trimSlashes = (p: string) => p.replace(/^\/+|\/+$/g, '')

/**
 * Whether a folder the model named opens this row. A row opens for its own path, for a folder below it,
 * and for a folder inside its compressed chain (`packages/next` opens the `packages/next/src` row).
 */
export function names(folder: TreeFolder, requested: string): boolean {
  const p = trimSlashes(requested)
  if (!p) return false
  if (p === folder.path || p.startsWith(`${folder.path}/`)) return true
  return folder.path.startsWith(`${p}/`) && p.length > folder.parent.length
}

/**
 * The folders that start open. With no `open` from the model: all of them at 20 files or fewer, otherwise
 * the selected file's path (or the single top folder, so the card never shows one closed row). The
 * selected file's path is always open, so the file the reader is pointed at is on screen.
 */
export function defaultOpen(
  nodes: readonly TreeNode[],
  options: { fileCount: number; selected?: string; open?: readonly string[] },
): Set<string> {
  const all = folders(nodes)
  const set = new Set<string>()
  const { fileCount, selected, open } = options
  if (!open && fileCount <= OPEN_ALL_AT) for (const f of all) set.add(f.path)
  for (const f of all) {
    if (selected && selected.startsWith(`${f.path}/`)) set.add(f.path)
    if (open?.some(p => names(f, p))) set.add(f.path)
  }
  const only = nodes[0]
  if (!open && set.size === 0 && nodes.length === 1 && only?.kind === 'folder') set.add(only.path)
  return set
}

export interface VisibleRow {
  node: TreeNode
  /** The folder row above it, for Left. '' at the top. */
  parent: string
}

/** The rows a reader can reach, top to bottom: what arrow keys walk. */
export function visibleRows(nodes: readonly TreeNode[], isOpen: (path: string) => boolean): VisibleRow[] {
  const out: VisibleRow[] = []
  const walk = (list: readonly TreeNode[], parent: string) => {
    for (const node of list) {
      out.push({ node, parent })
      if (node.kind === 'folder' && isOpen(node.path)) walk(node.children, node.path)
    }
  }
  walk(nodes, '')
  return out
}

/** The two count slots in characters, sized to the widest value anywhere in the tree so digits stack. */
export function countWidths(nodes: readonly TreeNode[], totals?: { additions: number; deletions: number }) {
  let add = 2
  let del = 2
  let files = 1
  const fit = (a: number, d: number) => {
    add = Math.max(add, formatAdd(a).length)
    del = Math.max(del, formatDel(d).length)
  }
  if (totals) fit(totals.additions, totals.deletions)
  const walk = (list: readonly TreeNode[]) => {
    for (const node of list) {
      fit(node.additions, node.deletions)
      if (node.kind === 'folder') {
        files = Math.max(files, formatWhole(node.files).length)
        walk(node.children)
      }
    }
  }
  walk(nodes)
  return { add, del, files }
}

export interface Truncated {
  head: string
  tail: string
}

const DELIMITER = /([/\-_.])/

/**
 * Middle truncation by whole words. The name splits at `/`, `-`, `_` and `.`; the word nearest the center
 * drops first, and the gap grows outward from there until the name fits in `max` characters with its
 * ellipsis. The first word always stays; a file keeps its extension and the word before it, a folder its
 * last segment. Returns null when the name fits. When nothing more can drop, returns the shortest form and
 * the row clips what is left.
 */
export function middleTruncate(name: string, max: number, kind: 'file' | 'folder'): Truncated | null {
  if (name.length <= max) return null
  const split = name.split(DELIMITER)
  const words = split.filter((_, i) => i % 2 === 0)
  const gaps = split.filter((_, i) => i % 2 === 1)
  const n = words.length
  if (n < 3) return null

  const kept = new Set<number>([0])
  // A leading dot (`.github`) leaves an empty first word; the word after it is the real first word.
  if (words[0] === '') kept.add(1)
  if (kind === 'file') {
    kept.add(n - 1)
    if (gaps[n - 2] === '.') kept.add(n - 2)
  } else {
    const lastSlash = gaps.lastIndexOf('/')
    if (lastSlash < 0) kept.add(n - 1)
    else for (let i = lastSlash + 1; i < n; i++) kept.add(i)
    // A last segment that leaves nothing to drop keeps only its last word.
    if (kept.size >= n) for (let i = lastSlash + 1; i < n - 1; i++) kept.delete(i)
  }
  const droppable = (i: number) => i > 0 && i < n && !kept.has(i)
  const center = (n - 1) / 2
  const distance = (i: number) => Math.abs(i - center)

  let first = -1
  for (let i = 0; i < n; i++) if (droppable(i) && (first < 0 || distance(i) < distance(first))) first = i
  if (first < 0) return null

  let lo = first
  let hi = first + 1
  const render = (): Truncated => ({
    head: words.slice(0, lo).map((w, i) => w + gaps[i]).join(''),
    tail: gaps[hi - 1] + words.slice(hi).map((w, i) => (i === 0 ? w : gaps[hi + i - 1] + w)).join(''),
  })
  const width = (t: Truncated) => t.head.length + 1 + t.tail.length

  let out = render()
  while (width(out) > max) {
    const left = droppable(lo - 1) ? lo - 1 : -1
    const right = droppable(hi) ? hi : -1
    if (left < 0 && right < 0) break
    if (left >= 0 && (right < 0 || distance(left) <= distance(right))) lo = left
    else hi = right + 1
    out = render()
  }
  return out
}

/** The words for a count of files: "1 file", "3,000 files". */
export const fileWords = (n: number) => `${formatWhole(n)} ${n === 1 ? 'file' : 'files'}`
