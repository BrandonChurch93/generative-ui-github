import type { GitHubClient } from '../../github/client'
import { GitHubError } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { CodeFrequencyShape } from '../../shapes'
import { COUNTING, isoWeek, requestStats, type Counting } from './request'

/** GitHub answers 422 for repos with 10,000 or more commits: it will never count them, so nothing is warming. */
export const UNAVAILABLE = 'unavailable'
export type Unavailable = typeof UNAVAILABLE

export function normalizeCodeFrequency(raw: unknown): CodeFrequencyShape {
  const weeks = Array.isArray(raw) ? (raw as [number, number, number][]) : []
  // GitHub reports deletions here as negative numbers, unlike /stats/contributors.
  return { weeks: weeks.map(([week, additions, deletions]) => ({ weekStart: isoWeek(week), additions, deletions: Math.abs(deletions) })) }
}

export async function fetchCodeFrequency(client: GitHubClient, repo: RepoRef): Promise<CodeFrequencyShape | Counting | Unavailable> {
  try {
    const raw = await requestStats<[number, number, number][]>(client, repo, 'code_frequency')
    return raw === COUNTING ? COUNTING : normalizeCodeFrequency(raw)
  } catch (error) {
    if (error instanceof GitHubError && error.status === 422) return UNAVAILABLE
    throw error
  }
}
