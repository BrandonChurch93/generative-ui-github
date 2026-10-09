import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { CheckRun, ChecksShape } from '../../shapes'
import { fetchPages } from './shared'

interface RestCheckRun {
  name: string
  status: CheckRun['status']
  conclusion: CheckRun['conclusion']
  started_at: string | null
  completed_at: string | null
}

/** A large matrix puts hundreds of checks on one commit; past this many pages the rest are not read. */
const MAX_PAGES = 10

export function toCheckRun(raw: RestCheckRun): CheckRun {
  return { name: raw.name, status: raw.status, conclusion: raw.conclusion, startedAt: raw.started_at, completedAt: raw.completed_at }
}

export async function fetchChecks(client: GitHubClient, repo: RepoRef, ref: string): Promise<ChecksShape> {
  const { items, capped } = await fetchPages<{ check_runs: RestCheckRun[] }, RestCheckRun>(
    client,
    'GET /repos/{owner}/{repo}/commits/{ref}/check-runs',
    { owner: repo.owner, repo: repo.name, ref, per_page: 100 },
    page => page.check_runs,
    MAX_PAGES,
  )
  return { ref, runs: items.map(toCheckRun), truncated: capped }
}
