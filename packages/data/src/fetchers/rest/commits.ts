import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { CommitsShape, ISODate } from '../../shapes'
import { toCommit, type RestCommit } from './shared'

/**
 * The 100 most recent commits on the default branch since `since`, optionally by one author. No per-commit
 * stats: each would cost a request. A busy repo fills the page in days, so `truncated` says the list stops short.
 */
export async function fetchCommits(client: GitHubClient, repo: RepoRef, options: { since: ISODate; author?: string }): Promise<CommitsShape> {
  const { data } = await client.rest<RestCommit[]>('GET /repos/{owner}/{repo}/commits', {
    owner: repo.owner,
    repo: repo.name,
    per_page: 100,
    since: options.since,
    ...(options.author ? { author: options.author } : {}),
  })
  return { since: options.since, commits: data.map(toCommit), truncated: data.length === 100 }
}
