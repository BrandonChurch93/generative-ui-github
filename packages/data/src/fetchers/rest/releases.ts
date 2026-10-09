import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { ReleasesShape } from '../../shapes'

interface RestRelease {
  name: string | null
  tag_name: string
  published_at: string | null
  created_at: string
  prerelease: boolean
  body: string | null
}

interface RestTag {
  name: string
  commit: { sha: string }
}

export function toReleases(releases: RestRelease[], tags: RestTag[]): ReleasesShape {
  return {
    releases: releases.map(r => ({
      name: r.name || r.tag_name,
      tag: r.tag_name,
      publishedAt: r.published_at ?? r.created_at,
      prerelease: r.prerelease,
      body: r.body ?? '',
    })),
    tags: tags.map(t => ({ name: t.name, sha: t.commit.sha })),
  }
}

export async function fetchReleases(client: GitHubClient, repo: RepoRef): Promise<ReleasesShape> {
  const params = { owner: repo.owner, repo: repo.name, per_page: 10 }
  const [releases, tags] = await Promise.all([
    client.rest<RestRelease[]>('GET /repos/{owner}/{repo}/releases', params),
    client.rest<RestTag[]>('GET /repos/{owner}/{repo}/tags', params),
  ])
  return toReleases(releases.data, tags.data)
}
