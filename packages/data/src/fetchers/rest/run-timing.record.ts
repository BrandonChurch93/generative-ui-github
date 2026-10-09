import type { GitHubClient } from '../../github/client'
import type { Scenario } from '../../github/fixtures'
import { fetchRunTiming } from './run-timing'
import { keyIs, NEXT, pick } from './scenario-helpers'
import { run as recentRuns, trimRuns } from './workflow-runs.record'

/** The slowest completed run among the most recent, as the slowest-run drill-down would pick it. */
export async function run(client: GitHubClient) {
  const { runs } = await recentRuns(client)
  const slowest = runs.filter(r => r.status === 'completed').sort((a, b) => b.durationMs - a.durationMs)[0]
  if (!slowest) throw new Error('next.js returned no completed runs')
  return fetchRunTiming(client, NEXT, slowest.id)
}

function trimJobs(key: string, body: unknown): unknown {
  if (!keyIs(key, /\/jobs$/)) return trimRuns(key, body)
  const jobs = (body as { jobs: { steps?: unknown[] }[] }).jobs
  return {
    jobs: jobs.map(j => ({
      ...pick(j, ['name', 'started_at', 'completed_at']),
      steps: (j.steps ?? []).map(s => pick(s, ['name', 'started_at', 'completed_at'])),
    })),
  }
}

export const scenario: Scenario = { name: 'rest-run-timing', run, trim: trimJobs }
