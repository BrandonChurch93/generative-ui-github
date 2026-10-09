import type { GitHubClient } from '../../github/client'
import type { Scenario } from '../../github/fixtures'
import { fetchCommits } from './commits'
import { NEXT, trimCommit } from './scenario-helpers'

export const SINCE = '2026-10-05T00:00:00Z'

export const run = (client: GitHubClient) => fetchCommits(client, NEXT, { since: SINCE })

export const scenario: Scenario = { name: 'rest-commits', run, trim: (_key, body) => (Array.isArray(body) ? body.map(trimCommit) : body) }
