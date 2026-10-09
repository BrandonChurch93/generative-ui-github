import type { GitHubClient } from '../../github/client'
import type { Scenario } from '../../github/fixtures'
import { fetchReadme } from './readme'
import { NEXT, pick } from './scenario-helpers'

export const run = (client: GitHubClient) => fetchReadme(client, NEXT)

/** Re-encoded after the cut, so the replay still decodes as GitHub's response would. */
function trimReadme(_key: string, body: unknown): unknown {
  const kept = pick(body, ['path', 'content', 'encoding'])
  if (kept.encoding === 'base64' && typeof kept.content === 'string') {
    kept.content = Buffer.from(Buffer.from(kept.content, 'base64').toString('utf8').slice(0, 1500), 'utf8').toString('base64')
  }
  return kept
}

export const scenario: Scenario = { name: 'rest-readme', run, trim: trimReadme }
