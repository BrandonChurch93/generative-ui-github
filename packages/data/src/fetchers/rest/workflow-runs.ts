import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { ISODate, WorkflowRun, WorkflowRunsShape } from '../../shapes'
import { elapsedMs } from './shared'

interface RestRun {
  id: number
  name: string | null
  status: WorkflowRun['status']
  conclusion: WorkflowRun['conclusion']
  run_attempt: number
  run_started_at: string
  updated_at: string
  head_sha: string
  event: string
}

interface RestRuns {
  workflow_runs: RestRun[]
}

export function toWorkflowRun(raw: RestRun): WorkflowRun {
  return {
    id: raw.id,
    workflowName: raw.name ?? '',
    status: raw.status,
    conclusion: raw.conclusion,
    runAttempt: raw.run_attempt,
    runStartedAt: raw.run_started_at,
    updatedAt: raw.updated_at,
    durationMs: elapsedMs(raw.run_started_at, raw.updated_at),
    headSha: raw.head_sha,
    event: raw.event,
  }
}

const DAY_MS = 86_400_000
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** GitHub's `created` filter is inclusive by calendar day, UTC. */
function createdRange(from: ISODate, to: ISODate): string {
  return `${from.slice(0, 10)}..${to.slice(0, 10)}`
}

export interface WorkflowRunsOptions {
  branch: string
  created?: { from: ISODate; to: ISODate }
}

/** The 100 most recent runs on `branch`, optionally only those created in a day range. */
export async function fetchWorkflowRuns(client: GitHubClient, repo: RepoRef, options: WorkflowRunsOptions): Promise<WorkflowRunsShape> {
  const { data } = await client.rest<RestRuns>('GET /repos/{owner}/{repo}/actions/runs', {
    owner: repo.owner,
    repo: repo.name,
    per_page: 100,
    branch: options.branch,
    ...(options.created ? { created: createdRange(options.created.from, options.created.to) } : {}),
  })
  return { branch: options.branch, runs: data.workflow_runs.map(toWorkflowRun) }
}

/** Monday to Sunday, UTC, oldest first, the week holding `now` last. */
export function weekRanges(now: Date, weeks: number): { from: string; to: string }[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const monday = today - ((now.getUTCDay() + 6) % 7) * DAY_MS
  return Array.from({ length: weeks }, (_, i) => {
    const start = monday - (weeks - 1 - i) * 7 * DAY_MS
    return { from: day(start), to: day(start + 6 * DAY_MS) }
  })
}

interface RestWorkflowRuns extends RestRuns {
  total_count: number
}

/** Pages read per week: enough for about 300 runs of one workflow, which covers the busiest repos we sample. */
export const PAGES_PER_WEEK = 3

/**
 * The workflow "CI" means: the one with the most push runs on the default branch among the latest 100 push
 * runs, or the most runs of any event when nothing runs on push. Busy repos run many small automation
 * workflows beside it, and a sample of all runs is mostly those.
 */
export async function findCiWorkflow(client: GitHubClient, repo: RepoRef, branch: string): Promise<{ id: number; name: string } | null> {
  const recent = async (event?: string) =>
    (
      await client.rest<RestRuns & { workflow_runs: (RestRun & { workflow_id: number })[] }>('GET /repos/{owner}/{repo}/actions/runs', {
        owner: repo.owner,
        repo: repo.name,
        branch,
        per_page: 100,
        exclude_pull_requests: true,
        ...(event ? { event } : {}),
      })
    ).data.workflow_runs
  let runs = await recent('push')
  if (!runs.length) runs = await recent()
  const counts = new Map<number, { id: number; name: string; n: number }>()
  for (const r of runs) {
    const entry = counts.get(r.workflow_id) ?? { id: r.workflow_id, name: r.name ?? '', n: 0 }
    entry.n += 1
    counts.set(r.workflow_id, entry)
  }
  const best = [...counts.values()].sort((a, b) => b.n - a.n || a.id - b.id)[0]
  return best ? { id: best.id, name: best.name } : null
}

/**
 * Twelve weeks of the CI workflow's runs, one week at a time and every page of each week up to the cap, so the
 * trend reads whole weeks, not the last hours of each. Runs come back newest first.
 */
export async function fetchWorkflowRunsByWeek(
  client: GitHubClient,
  repo: RepoRef,
  options: { branch: string; weeks?: number; now: Date },
): Promise<WorkflowRunsShape> {
  const workflow = await findCiWorkflow(client, repo, options.branch)
  if (!workflow) return { branch: options.branch, runs: [] }
  const ranges = weekRanges(options.now, options.weeks ?? 12)
  const week = async (range: { from: string; to: string }) => {
    const runs: RestRun[] = []
    for (let page = 1; page <= PAGES_PER_WEEK; page++) {
      const { data } = await client.rest<RestWorkflowRuns>('GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs', {
        owner: repo.owner,
        repo: repo.name,
        workflow_id: workflow.id,
        branch: options.branch,
        created: `${range.from}..${range.to}`,
        per_page: 100,
        page,
        exclude_pull_requests: true,
      })
      runs.push(...data.workflow_runs)
      if (runs.length >= data.total_count || data.workflow_runs.length < 100) break
    }
    return runs
  }
  const pages = await Promise.all(ranges.map(week))
  const byId = new Map<number, WorkflowRun>()
  for (const raw of pages.flat()) byId.set(raw.id, toWorkflowRun(raw))
  const runs = [...byId.values()].sort((a, b) => b.runStartedAt.localeCompare(a.runStartedAt))
  return { branch: options.branch, runs }
}
