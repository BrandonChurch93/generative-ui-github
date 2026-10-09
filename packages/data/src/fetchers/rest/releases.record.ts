import type { GitHubClient } from '../../github/client'
import type { Scenario } from '../../github/fixtures'
import { fetchReleases } from './releases'
import { keyIs, NEXT, trimRelease, trimTag } from './scenario-helpers'

export const run = (client: GitHubClient) => fetchReleases(client, NEXT)

export function trimReleases(key: string, body: unknown): unknown {
  if (!Array.isArray(body)) return body
  if (keyIs(key, /\/releases$/)) return body.map(trimRelease)
  if (keyIs(key, /\/tags$/)) return body.map(trimTag)
  return body
}

export const scenario: Scenario = { name: 'rest-releases', run, trim: trimReleases }
