import type { GitHubClient } from '../../github/client'
import type { Scenario } from '../../github/fixtures'
import { fetchPrFiles } from './pr-files'
import { keyIs, NEXT, pick, trimFile } from './scenario-helpers'

/** An open next.js PR with 28 changed files when recorded. */
export const PR_NUMBER = 99900

export const run = (client: GitHubClient) => fetchPrFiles(client, NEXT, PR_NUMBER)

function trimPrFiles(key: string, body: unknown): unknown {
  if (keyIs(key, /\/files$/) && Array.isArray(body)) return body.map(trimFile)
  return pick(body, ['changed_files'])
}

export const scenario: Scenario = { name: 'rest-pr-files', run, trim: trimPrFiles }
