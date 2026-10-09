import type { FileChange } from '@genui-github/data'
import { FileTree, FileTreeTree } from '@genui-github/ui/schemas'
import { sameRepo, systemDiffPath } from './DiffView'
import { bound, empty, unavailable, type Binder, type DataContext } from './types'

type FileTreeModel = FileTree.FileTreeModelProps
type Bound = FileTree.FileTreeProps
type Entry = FileTreeTree.FileEntry

const COMPONENT = 'FileTree'
const NOT_IN_DATA = "Not in this answer's data"

const under = (root: string | undefined) => (path: string) => !root || path === root || path.startsWith(`${root.replace(/\/$/, '')}/`)

interface Found {
  files: Entry[]
  total: number | undefined
  totals: { additions: number; deletions: number } | undefined
  emptyMeta: string
}

function changes(ctx: DataContext, props: FileTreeModel): Found | null {
  const prFiles = ctx.shapes.prFiles
  if (!prFiles || prFiles.number !== props.pr) return null
  const href = `https://github.com/${props.repo}/pull/${props.pr}/files`
  const files = prFiles.files.slice(0, FileTreeTree.FILE_CAP).map((f: FileChange) => ({ path: f.path, additions: f.additions, deletions: f.deletions, href }))
  const pulls = ctx.shapes.pulls
  const known = [...(pulls?.open ?? []), ...(pulls?.merged ?? []), ctx.shapes.biggestOpenPr?.pull].find(p => p?.number === props.pr)
  const total = known ? Math.max(known.changedFiles, files.length) : files.length
  return { files, total: prFiles.truncated || total > files.length ? total : undefined, totals: known ? { additions: known.additions, deletions: known.deletions } : undefined, emptyMeta: `#${props.pr}` }
}

/**
 * An overview root: between the last two releases, the files the compare changed (the release-diff screen's
 * changed areas); otherwise the default branch's tree under the path.
 */
function overview(ctx: DataContext, props: FileTreeModel): Found | null {
  const inside = under(props.path)
  const between = ctx.shapes.commitsBetweenTags
  if (ctx.scope?.release && between) {
    const href = `https://github.com/${props.repo}/compare/${between.base}...${between.head}`
    const files = between.files.filter(f => inside(f.path)).map(f => ({ path: f.path, additions: f.additions, deletions: f.deletions, href }))
    const whole = !props.path
    const total = whole ? Math.max(between.totals.changedFiles, files.length) : files.length
    return { files, total: total > files.length ? total : undefined, totals: whole ? { additions: between.totals.additions, deletions: between.totals.deletions } : undefined, emptyMeta: `${between.base} to ${between.head}` }
  }
  const tree = ctx.shapes.tree
  if (!tree) return null
  const blobs = tree.entries.filter(e => e.type === 'blob' && inside(e.path))
  const files = blobs.slice(0, FileTreeTree.FILE_CAP).map(e => ({ path: e.path, href: `https://github.com/${props.repo}/blob/${tree.sha}/${e.path.split('/').map(encodeURIComponent).join('/')}` }))
  return { files, total: blobs.length > files.length ? blobs.length : undefined, totals: undefined, emptyMeta: props.path ?? ctx.repo.defaultBranch }
}

/** A pull request's changed files, a release's changed files, or a folder of the tree, with the selected file checked against them. */
export const bindFileTree: Binder<FileTreeModel> = (ctx, props, extras = {}) => {
  const found = !sameRepo(ctx, props.repo) ? null : props.mode === 'changes' ? changes(ctx, props) : overview(ctx, props)
  if (!found) return unavailable(COMPONENT, props, { ...props, files: [] } satisfies Bound, { failed: FileTree.WORDS.failed, cause: NOT_IN_DATA }, extras)
  const { files, total, totals, emptyMeta } = found
  const out: Bound = { ...props, files, ...(total !== undefined ? { total } : {}), ...(totals ? { totals } : {}) }
  if (!files.length) return empty(COMPONENT, props, { ...out, emptyTone: props.emptyTone ?? 'neutral', emptyMeta }, extras)
  const selected = props.selected && files.some(f => f.path === props.selected) ? props.selected : props.mode === 'changes' && props.pr !== undefined ? systemDiffPath(ctx, props.pr) : undefined
  if (selected) out.selected = selected
  else delete out.selected
  return bound(COMPONENT, props, out, extras)
}
