import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { TreeShape } from '../../shapes'

interface RestTree {
  sha: string
  truncated: boolean
  tree: { path: string; type: 'blob' | 'tree' | 'commit'; size?: number }[]
}

/** Submodules (type `commit`) are dropped: they are not files in this repo. `sha` is the ref asked for, not the tree's own SHA. */
export function toTree(sha: string, raw: RestTree): TreeShape {
  const entries: TreeShape['entries'] = []
  for (const e of raw.tree) {
    if (e.type === 'commit') continue
    entries.push(e.size === undefined ? { path: e.path, type: e.type } : { path: e.path, type: e.type, size: e.size })
  }
  return { sha, entries, truncated: raw.truncated }
}

export async function fetchTree(client: GitHubClient, repo: RepoRef, sha: string): Promise<TreeShape> {
  const { data } = await client.rest<RestTree>('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
    owner: repo.owner,
    repo: repo.name,
    tree_sha: sha,
    recursive: 1,
  })
  return toTree(sha, data)
}
