import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { RunTimingShape } from '../../shapes'
import { elapsedMs, fetchPages } from './shared'

interface RestStep {
  name: string
  started_at: string | null
  completed_at: string | null
}

interface RestJob {
  name: string
  started_at: string | null
  completed_at: string | null
  steps?: RestStep[]
}

const MAX_PAGES = 10

export function toJob(raw: RestJob): RunTimingShape['jobs'][number] {
  return {
    name: raw.name,
    durationMs: elapsedMs(raw.started_at, raw.completed_at),
    steps: (raw.steps ?? []).map(s => ({ name: s.name, durationMs: elapsedMs(s.started_at, s.completed_at) })),
  }
}

/**
 * Job and step durations from `/actions/runs/{id}/jobs`. The `/timing` endpoint the docs name gives only
 * billable minutes per job, which a public repo reports as zero, and no steps.
 */
export async function fetchRunTiming(client: GitHubClient, repo: RepoRef, runId: number): Promise<RunTimingShape> {
  const { items } = await fetchPages<{ jobs: RestJob[] }, RestJob>(
    client,
    'GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs',
    { owner: repo.owner, repo: repo.name, run_id: runId, per_page: 100 },
    page => page.jobs,
    MAX_PAGES,
  )
  return { runId, jobs: items.map(toJob) }
}
