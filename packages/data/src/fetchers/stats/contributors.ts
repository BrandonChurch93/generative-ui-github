import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { ContributorsStatShape } from '../../shapes'
import { COUNTING, isoWeek, person, requestStats, type Counting } from './request'

interface RawContributor {
  author: { login: string; type?: string } | null
  total: number
  weeks: { w: number; a: number; d: number; c: number }[]
}

/**
 * GitHub sends every week since the repo began for each of the top 100 authors (hundreds of weeks on an old
 * repo); the shape keeps the last 52, like the other stats. `total` stays GitHub's all-time count.
 */
export const CONTRIBUTOR_WEEKS = 52
/** GitHub now returns up to 500 authors; the ranks and the bus factor read the top of the list. */
export const CONTRIBUTOR_AUTHORS = 100

export function normalizeContributors(raw: unknown): ContributorsStatShape {
  const authors = Array.isArray(raw) ? (raw as RawContributor[]) : []
  return {
    authors: authors
      .map(a => ({
        author: person(a.author),
        total: a.total,
        // Only weeks with work: every reader asks which weeks had commits, and 500 authors by 52 empty weeks is megabytes.
        weeks: a.weeks
          .slice(-CONTRIBUTOR_WEEKS)
          .filter(w => w.c > 0 || w.a > 0 || w.d > 0)
          .map(w => ({ weekStart: isoWeek(w.w), additions: w.a, deletions: w.d, commits: w.c })),
      }))
      .sort((x, y) => y.total - x.total || x.author.login.localeCompare(y.author.login))
      .slice(0, CONTRIBUTOR_AUTHORS),
  }
}

export async function fetchContributorsStat(client: GitHubClient, repo: RepoRef): Promise<ContributorsStatShape | Counting> {
  const raw = await requestStats<RawContributor[]>(client, repo, 'contributors')
  return raw === COUNTING ? COUNTING : normalizeContributors(raw)
}
