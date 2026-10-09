import type { GitHubClient } from '../../github/client'
import type { Scenario } from '../../github/fixtures'
import { fetchChecks } from './checks'
import { branchHead, defaultBranch, keyIs, NEXT, pick, trimDiscovery } from './scenario-helpers'

export async function run(client: GitHubClient) {
  return fetchChecks(client, NEXT, await branchHead(client, NEXT, await defaultBranch(client, NEXT)))
}

function trimChecks(key: string, body: unknown): unknown {
  if (!keyIs(key, /\/check-runs$/)) return trimDiscovery(key, body)
  const runs = (body as { check_runs: unknown[] }).check_runs
  return { check_runs: runs.map(r => pick(r, ['name', 'status', 'conclusion', 'started_at', 'completed_at'])) }
}

export const scenario: Scenario = { name: 'rest-checks', run, trim: trimChecks }
