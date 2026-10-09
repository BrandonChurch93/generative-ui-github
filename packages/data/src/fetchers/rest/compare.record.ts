import type { GitHubClient } from '../../github/client'
import type { Scenario } from '../../github/fixtures'
import { fetchCompare } from './compare'
import { fetchReleases } from './releases'
import { trimReleases } from './releases.record'
import { keyIs, NEXT, pick, trimCommit, trimFile } from './scenario-helpers'

/** The two most recent releases, older first. */
export async function run(client: GitHubClient) {
  const { releases } = await fetchReleases(client, NEXT)
  const [head, base] = releases
  if (!head || !base) throw new Error('next.js returned fewer than two releases')
  return fetchCompare(client, NEXT, base.tag, head.tag)
}

function trimCompare(key: string, body: unknown): unknown {
  if (!keyIs(key, /\/compare\//)) return trimReleases(key, body)
  const kept = pick(body, ['ahead_by', 'commits', 'files'])
  kept.commits = (kept.commits as unknown[]).map(trimCommit)
  if (Array.isArray(kept.files)) kept.files = kept.files.slice(0, 100).map(trimFile)
  return kept
}

export const scenario: Scenario = { name: 'rest-compare', run, trim: trimCompare }
