import type { FileChange } from '@genui-github/data'
import { DiffView, DiffViewPatch } from '@genui-github/ui/schemas'
import { bound, empty, unavailable, type Binder, type DataContext } from './types'

type DiffViewModel = DiffView.DiffViewModelProps
type Bound = DiffView.DiffViewProps

const COMPONENT = 'DiffView'
const FAILED = DiffView.DIFF_WORDS.failed

/** Whether a piece's `repo` prop names the repo the context describes. */
export const sameRepo = (ctx: DataContext, repo: string) => repo.toLowerCase() === `${ctx.repo.owner}/${ctx.repo.name}`.toLowerCase()

const size = (f: { additions: number; deletions: number }) => f.additions + f.deletions
const largestFile = <F extends FileChange>(files: readonly F[]): F | undefined => files.reduce<F | undefined>((max, f) => (!max || size(f) > size(max) ? f : max), undefined)

// Lockfiles are generated: GitHub collapses them by default, and their lines say nothing about the change.
const LOCKFILE = /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?|[\w.-]+\.lock)$/

/**
 * The file a DiffView shows when the model names none: the pull request's largest file with a patch, lockfiles
 * last. The data layer keeps patches only for the largest few files, so the largest is the one with its lines.
 */
export function systemDiffPath(ctx: DataContext, pr: number): string | undefined {
  const prFiles = ctx.shapes.prFiles
  if (!prFiles || prFiles.number !== pr) return undefined
  const patched = prFiles.files.filter(f => f.patch !== undefined)
  return (largestFile(patched.filter(f => !LOCKFILE.test(f.path))) ?? largestFile(patched) ?? largestFile(prFiles.files))?.path
}

/** One file of a pull request: GitHub's status, counts and patch. The component folds, stops and highlights. */
export const bindDiffView: Binder<DiffViewModel> = (ctx, props, extras = {}) => {
  const prFiles = ctx.shapes.prFiles
  const frame: Bound = { ...props, status: 'modified', additions: 0, deletions: 0 }
  if (!prFiles || prFiles.number !== props.pr || !sameRepo(ctx, props.repo)) {
    return unavailable(COMPONENT, props, frame, { failed: FAILED, cause: `#${props.pr}'s files are not in this answer's data` }, extras)
  }
  const file = prFiles.files.find(f => f.path === props.path)
  if (!file) {
    const cause = prFiles.truncated ? `Not among the files GitHub listed for #${props.pr}` : `Not one of #${props.pr}'s files`
    return unavailable(COMPONENT, props, frame, { failed: FAILED, cause }, extras)
  }
  const out: Bound = {
    ...props,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    url: `https://github.com/${props.repo}/pull/${props.pr}/files`,
    ...(file.patch !== undefined ? { patch: file.patch } : {}),
    ...(file.previousPath ? { previousPath: file.previousPath } : {}),
  }
  const changed = file.additions + file.deletions
  // A changed file with no patch past the component's limit says so itself; under it, the lines were left out of the context.
  if (file.patch === undefined && changed > 0 && changed <= DiffViewPatch.DIFF_LIMIT) {
    return unavailable(COMPONENT, props, out, { failed: FAILED, cause: "This file's diff is not in this answer's data" }, extras)
  }
  // A binary change reads as modified with no counts and no patch; the component names it. Anything else at zero has nothing to diff.
  if (changed === 0 && !(file.status === 'modified' && file.patch === undefined)) {
    return empty(COMPONENT, props, { ...out, emptyTone: props.emptyTone ?? 'neutral' }, extras)
  }
  return bound(COMPONENT, props, out, extras)
}
