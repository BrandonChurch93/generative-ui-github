import { isBotLogin } from '../../github/person'
import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { Person } from '../../shapes'

/** What a stats fetch returns while GitHub answers 202: it is still counting, which is warming, not an error. */
export const COUNTING = 'counting'
export type Counting = typeof COUNTING

export type StatsEndpoint = 'commit_activity' | 'code_frequency' | 'participation' | 'punch_card' | 'contributors'

export async function requestStats<T>(client: GitHubClient, repo: RepoRef, endpoint: StatsEndpoint): Promise<T | Counting | null> {
  const response = await client.rest<T>(`GET /repos/{owner}/{repo}/stats/${endpoint}`, { owner: repo.owner, repo: repo.name })
  if (response.status === 202) return COUNTING
  // An empty repo answers 204 with no body: that is zero commits, not a failure.
  return response.status === 204 ? null : response.data
}

export function isoWeek(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString()
}

export function person(user: { login: string; type?: string } | null | undefined): Person {
  // GitHub shows a deleted account as `ghost`.
  const login = user?.login ?? 'ghost'
  return { login, isBot: isBotLogin(login) || user?.type === 'Bot' }
}
