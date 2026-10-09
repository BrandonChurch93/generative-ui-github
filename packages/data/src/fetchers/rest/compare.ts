import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { CompareShape } from '../../shapes'
import { toCommit, toFileChange, type RestCommit, type RestFile } from './shared'

interface RestCompare {
  ahead_by: number
  commits: RestCommit[]
  files?: RestFile[]
}

/** GitHub lists at most 300 files here, so totals are over the files it returned. */
export function toCompare(base: string, head: string, raw: RestCompare): CompareShape {
  // The release view shows paths and counts, never a diff, so patches are dropped: on React they were a megabyte.
  const files = (raw.files ?? []).map(f => toFileChange({ ...f, patch: undefined }))
  return {
    base,
    head,
    aheadBy: raw.ahead_by,
    commits: raw.commits.map(toCommit),
    files,
    totals: {
      additions: files.reduce((sum, f) => sum + f.additions, 0),
      deletions: files.reduce((sum, f) => sum + f.deletions, 0),
      changedFiles: files.length,
    },
  }
}

export async function fetchCompare(client: GitHubClient, repo: RepoRef, base: string, head: string): Promise<CompareShape> {
  const { data } = await client.rest<RestCompare>('GET /repos/{owner}/{repo}/compare/{basehead}', {
    owner: repo.owner,
    repo: repo.name,
    basehead: `${base}...${head}`,
  })
  return toCompare(base, head, data)
}
