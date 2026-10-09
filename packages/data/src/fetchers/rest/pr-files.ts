import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { FileChange, PrFilesShape } from '../../shapes'
import { fetchPages, toFileChange, type RestFile } from './shared'

/** GitHub lists at most 3,000 files for a pull request: 30 pages of 100. */
const MAX_PAGES = 30

/** Pass `changedFiles` when the caller already has it (the pulls shape does) to save the `/pulls/{n}` call. */
export async function fetchPrFiles(client: GitHubClient, repo: RepoRef, number: number, options: { changedFiles?: number } = {}): Promise<PrFilesShape> {
  const base = { owner: repo.owner, repo: repo.name, pull_number: number }
  const changedFiles =
    options.changedFiles ?? (await client.rest<{ changed_files: number }>('GET /repos/{owner}/{repo}/pulls/{pull_number}', base)).data.changed_files
  const { items, capped } = await fetchPages<RestFile[], RestFile>(
    client,
    'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
    { ...base, per_page: 100 },
    page => page,
    MAX_PAGES,
  )
  return { number, files: keepPatches(items.map(toFileChange)), truncated: capped || items.length < changedFiles }
}

/** Files whose patch is kept: DiffView shows one file at a time, so the largest few are plenty. */
export const PATCHED_FILES = 10
/** A patch past this many characters is cut; a 3,000-file pull request otherwise runs to tens of megabytes. */
export const PATCH_CHARS = 20_000

/** Keeps the patches of the largest files, cut to size; the rest keep their paths and counts only. */
export function keepPatches(files: FileChange[]): FileChange[] {
  const largest = new Set([...files].sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions)).slice(0, PATCHED_FILES))
  return files.map(f => {
    if (f.patch === undefined) return f
    if (!largest.has(f)) {
      const { patch: _patch, ...rest } = f
      return rest
    }
    return f.patch.length > PATCH_CHARS ? { ...f, patch: f.patch.slice(0, f.patch.lastIndexOf('\n', PATCH_CHARS)) } : f
  })
}
