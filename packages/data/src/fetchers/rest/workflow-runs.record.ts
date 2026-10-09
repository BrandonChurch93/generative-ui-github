import type { GitHubClient } from '../../github/client'
import type { Scenario } from '../../github/fixtures'
import { defaultBranch, keyIs, NEXT, trimDiscovery, trimRun } from './scenario-helpers'
import { fetchWorkflowRuns } from './workflow-runs'

export async function run(client: GitHubClient) {
  return fetchWorkflowRuns(client, NEXT, { branch: await defaultBranch(client, NEXT) })
}

export function trimRuns(key: string, body: unknown): unknown {
  if (!keyIs(key, /\/actions\/runs$/)) return trimDiscovery(key, body)
  return { workflow_runs: (body as { workflow_runs: unknown[] }).workflow_runs.map(trimRun) }
}

export const scenario: Scenario = { name: 'rest-workflow-runs', run, trim: trimRuns }
