import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { CommitActivityShape } from '../../shapes'
import { COUNTING, isoWeek, requestStats, type Counting } from './request'

interface RawWeek {
  week: number
  total: number
  days: number[]
}

type Days = CommitActivityShape['weeks'][number]['days']

export function normalizeCommitActivity(raw: unknown): CommitActivityShape {
  const weeks = Array.isArray(raw) ? (raw as RawWeek[]) : []
  return {
    weeks: weeks.map(w => ({
      weekStart: isoWeek(w.week),
      days: Array.from({ length: 7 }, (_, i) => w.days[i] ?? 0) as Days,
      total: w.total,
    })),
  }
}

export async function fetchCommitActivity(client: GitHubClient, repo: RepoRef): Promise<CommitActivityShape | Counting> {
  const raw = await requestStats<RawWeek[]>(client, repo, 'commit_activity')
  return raw === COUNTING ? COUNTING : normalizeCommitActivity(raw)
}
