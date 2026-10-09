import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { Milestone, MilestonesShape } from '../../shapes'
import { query, RATE_LIMIT_FIELD } from './shared'

// Counts add issues and pull requests, as GitHub's milestone progress bar and REST's open_issues do.
export const MILESTONES_QUERY = `query Milestones($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    milestones(states: OPEN, first: 100, orderBy: { field: DUE_DATE, direction: ASC }) {
      nodes {
        number title dueOn
        openIssues: issues(states: OPEN) { totalCount }
        closedIssues: issues(states: CLOSED) { totalCount }
        openPulls: pullRequests(states: OPEN) { totalCount }
        closedPulls: pullRequests(states: [CLOSED, MERGED]) { totalCount }
      }
    }
  }
  ${RATE_LIMIT_FIELD}
}`

interface Count {
  totalCount: number
}

export interface MilestoneNode {
  number: number
  title: string
  dueOn: string | null
  openIssues: Count
  closedIssues: Count
  openPulls: Count
  closedPulls: Count
}

export interface MilestonesResponse {
  repository: { milestones: { nodes: MilestoneNode[] } }
}

export function normalizeMilestone(node: MilestoneNode): Milestone {
  return {
    number: node.number,
    title: node.title,
    dueOn: node.dueOn,
    open: node.openIssues.totalCount + node.openPulls.totalCount,
    closed: node.closedIssues.totalCount + node.closedPulls.totalCount,
  }
}

/** Soonest due first, undated last, so the next milestone is the first one. */
export function byDueDate(a: Milestone, b: Milestone): number {
  if (a.dueOn === b.dueOn) return a.number - b.number
  if (a.dueOn === null) return 1
  if (b.dueOn === null) return -1
  return Date.parse(a.dueOn) - Date.parse(b.dueOn)
}

export async function fetchMilestones(client: GitHubClient, repo: RepoRef): Promise<MilestonesShape> {
  const { repository } = await query<MilestonesResponse>(client, 'milestones', MILESTONES_QUERY, { owner: repo.owner, name: repo.name })
  return { open: repository.milestones.nodes.map(normalizeMilestone).sort(byDueDate) }
}
