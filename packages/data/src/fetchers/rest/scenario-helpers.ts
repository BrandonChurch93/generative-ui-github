import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'

// Shared by the rest-* scenarios only. Production callers get the branch and head SHA from the repo shape.

export const NEXT: RepoRef = { owner: 'vercel', name: 'next.js' }

export async function defaultBranch(client: GitHubClient, repo: RepoRef): Promise<string> {
  const { data } = await client.rest<{ default_branch: string }>('GET /repos/{owner}/{repo}', { owner: repo.owner, repo: repo.name })
  return data.default_branch
}

export async function branchHead(client: GitHubClient, repo: RepoRef, branch: string): Promise<string> {
  const { data } = await client.rest<{ commit: { sha: string } }>('GET /repos/{owner}/{repo}/branches/{branch}', {
    owner: repo.owner,
    repo: repo.name,
    branch,
  })
  return data.commit.sha
}

type Json = Record<string, unknown>

export function pick(value: unknown, keys: string[]): Json {
  const source = (value ?? {}) as Json
  return Object.fromEntries(keys.filter(k => k in source).map(k => [k, source[k]]))
}

export function cut(text: unknown, max: number): unknown {
  return typeof text === 'string' && text.length > max ? text.slice(0, max) : text
}

/** A path match on the recorded key, which is `METHOD /path?query`. */
export function keyIs(key: string, pattern: RegExp): boolean {
  return pattern.test(key.split('?')[0] ?? '')
}

/** What a scenario keeps of the repo and branch calls. */
export function trimDiscovery(key: string, body: unknown): unknown {
  if (keyIs(key, /^GET \/repos\/[^/]+\/[^/]+$/)) return pick(body, ['default_branch'])
  if (keyIs(key, /\/branches\/[^/]+$/)) return { commit: pick((body as Json).commit, ['sha']) }
  return body
}

export function trimRun(run: unknown): Json {
  return pick(run, ['id', 'name', 'status', 'conclusion', 'run_attempt', 'run_started_at', 'updated_at', 'head_sha', 'event'])
}

export function trimCommit(commit: unknown): Json {
  const c = commit as { sha: string; author: unknown; commit: Json }
  return {
    sha: c.sha,
    author: c.author ? pick(c.author, ['login', 'type']) : null,
    commit: { message: cut(c.commit.message, 300), author: pick(c.commit.author, ['date']), committer: pick(c.commit.committer, ['date']) },
  }
}

export function trimFile(file: unknown): Json {
  const kept = pick(file, ['filename', 'status', 'additions', 'deletions', 'patch', 'previous_filename'])
  if ('patch' in kept) kept.patch = cut(kept.patch, 200)
  return kept
}

export function trimRelease(release: unknown): Json {
  const kept = pick(release, ['name', 'tag_name', 'published_at', 'created_at', 'prerelease', 'body'])
  kept.body = cut(kept.body, 300)
  return kept
}

export function trimTag(tag: unknown): Json {
  return { name: (tag as Json).name, commit: pick((tag as Json).commit, ['sha']) }
}
