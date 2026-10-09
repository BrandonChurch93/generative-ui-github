import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { Issue, IssuesShape } from '../../shapes'
import { firstHumanAt, names, newestFirst, query, RATE_LIMIT_FIELD, toPerson, type ActorNode } from './shared'

const ISSUE_FIELDS = `
  number title url author { login __typename }
  labels(first: 10) { nodes { name } }
  assignees(first: 10) { nodes { login } }
  comments(first: 10) { totalCount nodes { author { login __typename } createdAt } }
  reactions { totalCount }
  createdAt updatedAt closedAt
  milestone { title }`

// A busy repo has thousands of open issues. The 50 most active and the 50 most idle together feed
// both the good-first list (recent) and the stale list (idle over 30 days), which the default
// oldest-created order would not. GitHub's issues connection already leaves pull requests out.
export const ISSUES_QUERY = `query Issues($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    active: issues(states: OPEN, first: 50, orderBy: { field: UPDATED_AT, direction: DESC }) { nodes { ${ISSUE_FIELDS} } }
    idle: issues(states: OPEN, first: 50, orderBy: { field: UPDATED_AT, direction: ASC }) { nodes { ${ISSUE_FIELDS} } }
    closed: issues(states: CLOSED, first: 50, orderBy: { field: UPDATED_AT, direction: DESC }) { nodes { ${ISSUE_FIELDS} } }
  }
  ${RATE_LIMIT_FIELD}
}`

export interface IssueNode {
  number: number
  title: string
  url: string
  author: ActorNode | null
  labels: { nodes: { name: string }[] } | null
  assignees: { nodes: { login: string }[] }
  comments: { totalCount: number; nodes: { author: ActorNode | null; createdAt: string }[] }
  reactions: { totalCount: number }
  createdAt: string
  updatedAt: string
  closedAt: string | null
  milestone: { title: string } | null
}

export interface IssuesResponse {
  repository: { active: { nodes: IssueNode[] }; idle: { nodes: IssueNode[] }; closed: { nodes: IssueNode[] } }
}

export function normalizeIssue(node: IssueNode): Issue {
  const author = toPerson(node.author)
  return {
    number: node.number,
    title: node.title,
    url: node.url,
    author,
    labels: names(node.labels),
    assignees: node.assignees.nodes.map(a => a.login),
    comments: node.comments.totalCount,
    reactions: node.reactions.totalCount,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    closedAt: node.closedAt,
    milestone: node.milestone?.title ?? null,
    firstHumanCommentAt: firstHumanAt(node.comments.nodes.map(c => ({ author: toPerson(c.author), at: c.createdAt })), author),
  }
}

/** Open: up to 100, most recently updated first. Closed: the 50 most recently updated, sorted by close time, newest first. */
export async function fetchIssues(client: GitHubClient, repo: RepoRef): Promise<IssuesShape> {
  const { repository } = await query<IssuesResponse>(client, 'issues', ISSUES_QUERY, { owner: repo.owner, name: repo.name })
  const open = new Map<number, Issue>()
  // A repo with fewer than 100 open issues returns some in both lists.
  for (const node of [...repository.active.nodes, ...repository.idle.nodes]) open.set(node.number, normalizeIssue(node))
  return {
    open: [...open.values()].sort(newestFirst(i => i.updatedAt)),
    closed: repository.closed.nodes.map(normalizeIssue).sort(newestFirst(i => i.closedAt)),
  }
}
