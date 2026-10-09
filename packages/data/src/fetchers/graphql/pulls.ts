import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { AuthorAssociation, Pull, PullsShape, Review } from '../../shapes'
import { firstHumanAt, names, newestFirst, query, RATE_LIMIT_FIELD, toPerson, type ActorNode } from './shared'

const ACTOR = 'author { login __typename }'

const PULL_FIELDS = `
  number title url ${ACTOR} authorAssociation isDraft
  labels(first: 10) { nodes { name } }
  reviewDecision
  reviews(first: 10) { nodes { ${ACTOR} state submittedAt } }
  comments(first: 10) { nodes { ${ACTOR} createdAt } }
  createdAt updatedAt mergedAt closedAt
  additions deletions changedFiles
  milestone { title }
  headRefName`

const PAGE = 50
const MERGED_PAGES = 2

// Open: the most recently updated, so abandoned pulls from years ago do not fill the list.
export const OPEN_PULLS_QUERY = `query OpenPulls($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    pullRequests(states: OPEN, first: ${PAGE}, orderBy: { field: UPDATED_AT, direction: DESC }) {
      nodes { ${PULL_FIELDS} }
    }
  }
  ${RATE_LIMIT_FIELD}
}`

// Merged: the newest created, paged backward. GraphQL cannot order by merge time, and ordering by
// update fills the list with pulls a lock bot touched two weeks after merging: on vercel/next.js
// that order held only 33 of the 80 pulls merged in the last 6 days; this one held 76.
// Pages stay at 50: one query for 150 pulls timed out at GitHub (502) twice out of three.
export const MERGED_PULLS_QUERY = `query MergedPulls($owner: String!, $name: String!, $before: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(states: MERGED, last: ${PAGE}, before: $before) {
      pageInfo { hasPreviousPage startCursor }
      nodes { ${PULL_FIELDS} }
    }
  }
  ${RATE_LIMIT_FIELD}
}`

export interface PullNode {
  number: number
  title: string
  url: string
  author: ActorNode | null
  authorAssociation: AuthorAssociation
  isDraft: boolean
  labels: { nodes: { name: string }[] } | null
  reviewDecision: Pull['reviewDecision']
  reviews: { nodes: { author: ActorNode | null; state: Review['state']; submittedAt: string | null }[] } | null
  comments: { nodes: { author: ActorNode | null; createdAt: string }[] }
  createdAt: string
  updatedAt: string
  mergedAt: string | null
  closedAt: string | null
  additions: number
  deletions: number
  changedFiles: number
  milestone: { title: string } | null
  headRefName: string
}

export interface PullsResponse {
  repository: { pullRequests: { pageInfo?: { hasPreviousPage: boolean; startCursor: string | null }; nodes: PullNode[] } }
}

export function normalizePull(node: PullNode): Pull {
  const author = toPerson(node.author)
  // A pending review has no submit time and is visible only to its writer; it is not a response yet.
  const reviews: Review[] = (node.reviews?.nodes ?? []).flatMap(r =>
    r.submittedAt ? [{ author: toPerson(r.author), state: r.state, submittedAt: r.submittedAt }] : [],
  )
  return {
    number: node.number,
    title: node.title,
    url: node.url,
    author,
    authorAssociation: node.authorAssociation,
    draft: node.isDraft,
    labels: names(node.labels),
    reviewDecision: node.reviewDecision,
    reviews,
    firstHumanReviewAt: firstHumanAt(reviews.map(r => ({ author: r.author, at: r.submittedAt })), author),
    firstHumanCommentAt: firstHumanAt(node.comments.nodes.map(c => ({ author: toPerson(c.author), at: c.createdAt })), author),
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    mergedAt: node.mergedAt,
    closedAt: node.closedAt,
    additions: node.additions,
    deletions: node.deletions,
    changedFiles: node.changedFiles,
    milestone: node.milestone?.title ?? null,
    headRef: node.headRefName,
  }
}

async function mergedPulls(client: GitHubClient, repo: RepoRef): Promise<PullNode[]> {
  const nodes: PullNode[] = []
  let before: string | null = null
  for (let page = 0; page < MERGED_PAGES; page++) {
    const variables: Record<string, unknown> = { owner: repo.owner, name: repo.name, before }
    const { repository } = await query<PullsResponse>(client, 'pulls.merged', MERGED_PULLS_QUERY, variables)
    nodes.push(...repository.pullRequests.nodes)
    const info = repository.pullRequests.pageInfo
    if (!info?.hasPreviousPage) break
    before = info.startCursor
  }
  return nodes
}

/** Open: the 50 most recently updated. Merged: the 100 most recently created, sorted by merge time, newest first. */
export async function fetchPulls(client: GitHubClient, repo: RepoRef): Promise<PullsShape> {
  const [open, merged] = await Promise.all([
    query<PullsResponse>(client, 'pulls.open', OPEN_PULLS_QUERY, { owner: repo.owner, name: repo.name }),
    mergedPulls(client, repo),
  ])
  return {
    open: open.repository.pullRequests.nodes.map(normalizePull),
    merged: merged.map(normalizePull).sort(newestFirst(p => p.mergedAt)),
  }
}
