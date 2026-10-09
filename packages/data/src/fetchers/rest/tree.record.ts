import type { GitHubClient } from '../../github/client'
import type { Scenario } from '../../github/fixtures'
import type { RepoRef } from '../../github/resolve'
import { branchHead, defaultBranch, trimDiscovery } from './scenario-helpers'
import { fetchTree } from './tree'

/** The next.js tree runs to tens of thousands of entries; a small repo keeps the fixture honest and whole. */
export const SMALL: RepoRef = { owner: 'vercel', name: 'ms' }

export async function run(client: GitHubClient) {
  const sha = await branchHead(client, SMALL, await defaultBranch(client, SMALL))
  return fetchTree(client, SMALL, sha)
}

export const scenario: Scenario = { name: 'rest-tree', run, trim: trimDiscovery }
