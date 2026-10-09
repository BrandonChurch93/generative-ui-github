import type { GitHubClient } from '../../github/client'
import type { Scenario } from '../../github/fixtures'
import { defaultBranch, keyIs, NEXT, trimDiscovery, trimRun } from './scenario-helpers'
import { fetchWorkflowRunsByWeek } from './workflow-runs'

/** Fixed so the twelve `created` ranges, and so the request keys, replay exactly. */
export const NOW = new Date('2026-10-09T07:00:00Z')

/** Whole weeks of build-and-test run past the fixture budget; 40 runs a page still exercise the paging and the merge. */
const KEPT_PER_PAGE = 40

export async function run(client: GitHubClient) {
  return fetchWorkflowRunsByWeek(client, NEXT, { branch: await defaultBranch(client, NEXT), now: NOW })
}

function trimWeek(key: string, body: unknown): unknown {
  if (!keyIs(key, /\/actions\/(workflows\/\d+\/)?runs$/)) return trimDiscovery(key, body)
  const { workflow_runs, total_count } = body as { workflow_runs: unknown[]; total_count: number }
  const workflow = key.includes('/workflows/')
  return {
    total_count,
    workflow_runs: (workflow ? workflow_runs.slice(0, KEPT_PER_PAGE) : workflow_runs).map(r => ({ ...trimRun(r), workflow_id: (r as { workflow_id: number }).workflow_id })),
  }
}

export const scenario: Scenario = { name: 'rest-workflow-runs-by-week', run, trim: trimWeek }
