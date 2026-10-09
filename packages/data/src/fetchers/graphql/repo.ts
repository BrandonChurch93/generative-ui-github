import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { RepoShape } from '../../shapes'
import { query, RATE_LIMIT_FIELD } from './shared'

export const REPO_QUERY = `query Repo($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    owner { login }
    name
    description
    repositoryTopics(first: 20) { nodes { topic { name } } }
    licenseInfo { spdxId name }
    defaultBranchRef { name target { oid } }
    stargazerCount
    forkCount
    watchers { totalCount }
    issues(states: OPEN) { totalCount }
    createdAt
    pushedAt
    primaryLanguage { name }
    languages(first: 20, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } }
  }
  ${RATE_LIMIT_FIELD}
}`

export interface RepoResponse {
  repository: {
    owner: { login: string }
    name: string
    description: string | null
    repositoryTopics: { nodes: { topic: { name: string } }[] }
    licenseInfo: { spdxId: string | null; name: string } | null
    defaultBranchRef: { name: string; target: { oid: string } | null } | null
    stargazerCount: number
    forkCount: number
    watchers: { totalCount: number }
    issues: { totalCount: number }
    createdAt: string
    pushedAt: string | null
    primaryLanguage: { name: string } | null
    languages: { edges: { size: number; node: { name: string } }[] } | null
  }
}

export function normalizeRepo({ repository: r }: RepoResponse): RepoShape {
  return {
    owner: r.owner.login,
    name: r.name,
    description: r.description || null,
    topics: r.repositoryTopics.nodes.map(n => n.topic.name),
    // GitHub marks a license it cannot classify as NOASSERTION; its name ("Other") is the honest label.
    license: r.licenseInfo ? (r.licenseInfo.spdxId && r.licenseInfo.spdxId !== 'NOASSERTION' ? r.licenseInfo.spdxId : r.licenseInfo.name) : null,
    // An empty repo has no default branch yet; the shape has no null for it, so it reads as empty strings.
    defaultBranch: r.defaultBranchRef?.name ?? '',
    defaultBranchSha: r.defaultBranchRef?.target?.oid ?? '',
    stars: r.stargazerCount,
    forks: r.forkCount,
    watchers: r.watchers.totalCount,
    openIssues: r.issues.totalCount,
    createdAt: r.createdAt,
    pushedAt: r.pushedAt ?? r.createdAt,
    primaryLanguage: r.primaryLanguage?.name ?? null,
    languages: (r.languages?.edges ?? []).map(e => ({ name: e.node.name, bytes: e.size })),
  }
}

/** `openIssues` counts issues only, as the Issues tab does; REST's `open_issues_count` also counts open pull requests. */
export async function fetchRepo(client: GitHubClient, repo: RepoRef): Promise<RepoShape> {
  return normalizeRepo(await query<RepoResponse>(client, 'repo', REPO_QUERY, { owner: repo.owner, name: repo.name }))
}
