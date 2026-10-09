import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { PrFilesShape } from '../../shapes'
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
  return { number, files: items.map(toFileChange), truncated: capped || items.length < changedFiles }
}
