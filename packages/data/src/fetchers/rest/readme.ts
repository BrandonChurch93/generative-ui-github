import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { ReadmeShape } from '../../shapes'

interface RestReadme {
  path: string
  content: string
  encoding: string
}

export function toReadme(raw: RestReadme): ReadmeShape {
  const text = raw.encoding === 'base64' ? Buffer.from(raw.content, 'base64').toString('utf8') : raw.content
  return { path: raw.path, text }
}

export async function fetchReadme(client: GitHubClient, repo: RepoRef): Promise<ReadmeShape> {
  const { data } = await client.rest<RestReadme>('GET /repos/{owner}/{repo}/readme', { owner: repo.owner, repo: repo.name })
  return toReadme(data)
}
