import type { GitHubClient } from '../../github/client'
import type { Scenario } from '../../github/fixtures'
import { fetchCommunity } from './community'
import { NEXT, pick } from './scenario-helpers'

export const run = (client: GitHubClient) => fetchCommunity(client, NEXT)

export const scenario: Scenario = { name: 'rest-community', run, trim: (_key, body) => pick(body, ['health_percentage', 'files']) }
