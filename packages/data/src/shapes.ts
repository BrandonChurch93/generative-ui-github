// The shapes from the docs/data-layer.md tables. Types only; the fetchers arrive in Phase 4.

export type ISODate = string

export interface Person {
  login: string
  isBot: boolean
}

export interface FileChange {
  path: string
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged'
  additions: number
  deletions: number
  patch?: string
  previousPath?: string
}

export interface RepoShape {
  owner: string
  name: string
  description: string | null
  topics: string[]
  license: string | null
  defaultBranch: string
  defaultBranchSha: string
  stars: number
  forks: number
  watchers: number
  openIssues: number
  createdAt: ISODate
  pushedAt: ISODate
  primaryLanguage: string | null
  languages: { name: string; bytes: number }[]
}

export interface Review {
  author: Person
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'
  submittedAt: ISODate
}

/** GitHub's word for how an author relates to the repo. OWNER, MEMBER and COLLABORATOR are the core team. */
export type AuthorAssociation = 'OWNER' | 'MEMBER' | 'COLLABORATOR' | 'CONTRIBUTOR' | 'FIRST_TIME_CONTRIBUTOR' | 'FIRST_TIMER' | 'MANNEQUIN' | 'NONE'

export interface Pull {
  number: number
  title: string
  url: string
  author: Person
  authorAssociation: AuthorAssociation
  draft: boolean
  labels: string[]
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
  reviews: Review[]
  /** The first review by a human other than the author; bots excluded. */
  firstHumanReviewAt: ISODate | null
  /** The first comment by a human other than the author; bots excluded. */
  firstHumanCommentAt: ISODate | null
  createdAt: ISODate
  updatedAt: ISODate
  mergedAt: ISODate | null
  closedAt: ISODate | null
  additions: number
  deletions: number
  changedFiles: number
  milestone: string | null
  headRef: string
}

export interface PullsShape {
  open: Pull[]
  merged: Pull[]
}

export interface Issue {
  number: number
  title: string
  url: string
  author: Person
  labels: string[]
  assignees: string[]
  comments: number
  reactions: number
  createdAt: ISODate
  updatedAt: ISODate
  closedAt: ISODate | null
  milestone: string | null
  /** The first comment by a human other than the author; bots excluded. */
  firstHumanCommentAt: ISODate | null
}

export interface IssuesShape {
  open: Issue[]
  /** The 50 most recently closed, for time to close. */
  closed: Issue[]
}

/**
 * Exact counts from GitHub search, where the lists above are capped samples: opened, closed and merged per week
 * for 12 weeks (oldest first, Monday UTC), merged per month for last month and this one, and today's open counts.
 */
export interface ActivityShape {
  weeks: { weekStart: ISODate; issuesOpened: number; issuesClosed: number; pullsOpened: number; pullsClosed: number; pullsMerged: number }[]
  /** Last month, then this month so far. `month` is YYYY-MM, UTC. */
  months: { month: string; pullsMerged: number }[]
  open: {
    pulls: number
    drafts: number
    /** Ready for review and no review yet. */
    awaitingReview: number
    changesRequested: number
    issues: number
    /** Open issues with no activity for 30 days. */
    staleIssues: number
    /** Labeled good first issue or help wanted. */
    goodFirstIssues: number
  }
}

export interface Milestone {
  number: number
  title: string
  dueOn: ISODate | null
  open: number
  closed: number
}

export interface MilestonesShape {
  open: Milestone[]
}

export interface ReleasesShape {
  releases: { name: string; tag: string; publishedAt: ISODate; prerelease: boolean; body: string }[]
  tags: { name: string; sha: string }[]
}

export interface CommunityShape {
  healthPercentage: number
  files: {
    readme: boolean
    contributing: boolean
    codeOfConduct: boolean
    license: boolean
    issueTemplate: boolean
    pullRequestTemplate: boolean
  }
}

export interface Commit {
  sha: string
  author: Person | null
  date: ISODate
  message: string
}

export interface CommitsShape {
  since: ISODate
  commits: Commit[]
  /** A full page came back, so there are more commits since `since` than listed. */
  truncated: boolean
}

export interface WorkflowRun {
  id: number
  workflowName: string
  status: 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending'
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | 'neutral' | 'stale' | null
  runAttempt: number
  runStartedAt: ISODate
  updatedAt: ISODate
  /** updated minus run_started. */
  durationMs: number
  headSha: string
  event: string
}

export interface WorkflowRunsShape {
  branch: string
  runs: WorkflowRun[]
}

export interface RunTimingShape {
  runId: number
  jobs: { name: string; durationMs: number; steps: { name: string; durationMs: number }[] }[]
}

export interface CheckRun {
  name: string
  status: 'queued' | 'in_progress' | 'completed'
  conclusion: WorkflowRun['conclusion']
  startedAt: ISODate | null
  completedAt: ISODate | null
}

export interface ChecksShape {
  ref: string
  runs: CheckRun[]
  /** More check runs than the pages read; the counts cover only what was listed. */
  truncated: boolean
}

export interface CompareShape {
  base: string
  head: string
  aheadBy: number
  commits: Commit[]
  files: FileChange[]
  totals: { additions: number; deletions: number; changedFiles: number }
}

export interface PrFilesShape {
  number: number
  files: FileChange[]
  /** GitHub stops listing at its cap (3,000 files, verified in 4.5). */
  truncated: boolean
}

export interface TreeShape {
  sha: string
  entries: { path: string; type: 'blob' | 'tree'; size?: number }[]
  truncated: boolean
}

export interface ReadmeShape {
  path: string
  text: string
}

/** 52 weeks of per-day commit counts. Days are Sunday first, as GitHub returns them. */
export interface CommitActivityShape {
  weeks: { weekStart: ISODate; days: [number, number, number, number, number, number, number]; total: number }[]
}

export interface CodeFrequencyShape {
  weeks: { weekStart: ISODate; additions: number; deletions: number }[]
}

/** 52 weeks, oldest first. */
export interface ParticipationShape {
  all: number[]
  owner: number[]
}

/** Day by hour. Reordered Monday first (day 0 is Monday) and shifted into `timeZone` by the data layer. */
export interface PunchCardShape {
  timeZone: string
  cells: { day: number; hour: number; commits: number }[]
}

/** GitHub's top 100 authors. `total` is all-time; `weeks` holds the last 52 only. */
export interface ContributorsStatShape {
  authors: {
    author: Person
    total: number
    weeks: { weekStart: ISODate; additions: number; deletions: number; commits: number }[]
  }[]
}

// Derived shapes the templates need.

export interface CiDurationByWeekShape {
  /** The workflow the trend follows: the one with the most push runs on the default branch. */
  workflow: string | null
  weeks: { weekStart: ISODate; p50Ms: number; p90Ms: number; count: number; failures: number }[]
}

export interface FailureRateByWeekShape {
  weeks: { weekStart: ISODate; runs: number; failures: number; rate: number }[]
}

export interface SlowestJobShape {
  runId: number
  workflowName: string
  job: string
  durationMs: number
}

export interface StaleIssuesShape {
  issues: (Issue & { lastActivityAt: ISODate; idleDays: number })[]
}

export interface GoodFirstIssuesShape {
  issues: Issue[]
}

export interface BiggestOpenPrShape {
  pull: Pull | null
}

export interface BlockingPrsShape {
  milestone: Milestone | null
  pulls: (Pull & { waitingMs: number })[]
}

export interface CommitsBetweenTagsShape {
  base: string
  head: string
  commits: Commit[]
  files: FileChange[]
  totals: CompareShape['totals']
}

export interface BusiestHourShape {
  hour: number
  commits: number
  timeZone: string
}

export interface QuietestDayShape {
  /** 0 is Monday. */
  day: number
  name: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'
  commits: number
}

export interface MergedByDayShape {
  window: string
  timeZone: string
  days: { date: ISODate; pulls: Pull[] }[]
}

export interface ContributorShareShape {
  window: '90d'
  commits: { author: Person; count: number; share: number }[]
  reviews: { author: Person; count: number; share: number }[]
}

export interface MonthCompareShape {
  /** A value is null when the data does not reach back over that month. A zero is a real zero. */
  current: { month: string; values: Record<'prs-merged' | 'review-wait-median' | 'failing-check-rate' | 'time-to-close-median', number | null> }
  previous: MonthCompareShape['current']
}

/** Every shape by name, the names docs/data-layer.md uses. */
export interface ShapeMap {
  repo: RepoShape
  pulls: PullsShape
  issues: IssuesShape
  activity: ActivityShape
  milestones: MilestonesShape
  releases: ReleasesShape
  community: CommunityShape
  commits: CommitsShape
  workflowRuns: WorkflowRunsShape
  runTiming: RunTimingShape
  checks: ChecksShape
  compare: CompareShape
  prFiles: PrFilesShape
  tree: TreeShape
  readme: ReadmeShape
  'stats.commitActivity': CommitActivityShape
  'stats.codeFrequency': CodeFrequencyShape
  'stats.participation': ParticipationShape
  'stats.punchCard': PunchCardShape
  'stats.contributors': ContributorsStatShape
  ciDurationByWeek: CiDurationByWeekShape
  failureRateByWeek: FailureRateByWeekShape
  slowestJob: SlowestJobShape
  staleIssues: StaleIssuesShape
  goodFirstIssues: GoodFirstIssuesShape
  biggestOpenPr: BiggestOpenPrShape
  blockingPrs: BlockingPrsShape
  commitsBetweenTags: CommitsBetweenTagsShape
  busiestHour: BusiestHourShape
  quietestDay: QuietestDayShape
  mergedByDay: MergedByDayShape
  contributorShare: ContributorShareShape
  monthCompare: MonthCompareShape
}

export type ShapeName = keyof ShapeMap

/** Every shape the data layer returns carries the time it was fetched, so the UI can say "copy from Oct 5". */
export type Cached<T> = T & { cachedAt: ISODate }

const shapeNames = {
  repo: 'fetched',
  pulls: 'fetched',
  issues: 'fetched',
  activity: 'fetched',
  milestones: 'fetched',
  releases: 'fetched',
  community: 'fetched',
  commits: 'fetched',
  workflowRuns: 'fetched',
  runTiming: 'fetched',
  checks: 'fetched',
  compare: 'fetched',
  prFiles: 'fetched',
  tree: 'fetched',
  readme: 'fetched',
  'stats.commitActivity': 'stats',
  'stats.codeFrequency': 'stats',
  'stats.participation': 'stats',
  'stats.punchCard': 'stats',
  'stats.contributors': 'stats',
  ciDurationByWeek: 'derived',
  failureRateByWeek: 'derived',
  slowestJob: 'derived',
  staleIssues: 'derived',
  goodFirstIssues: 'derived',
  biggestOpenPr: 'derived',
  blockingPrs: 'derived',
  commitsBetweenTags: 'derived',
  busiestHour: 'derived',
  quietestDay: 'derived',
  mergedByDay: 'derived',
  contributorShare: 'derived',
  monthCompare: 'derived',
} as const satisfies Record<ShapeName, 'fetched' | 'stats' | 'derived'>

export const SHAPE_NAMES = Object.keys(shapeNames) as ShapeName[]
export const SHAPE_KIND: Readonly<Record<ShapeName, 'fetched' | 'stats' | 'derived'>> = shapeNames

export function isShapeName(name: string): name is ShapeName {
  return Object.hasOwn(shapeNames, name)
}

/** One type for the data layer, the shell and WarmingUp (docs/schemas.md). */
export interface WarmingStatus {
  repo: string
  phase: 'warming' | 'stopped'
  attempt: number
  nextCheckMs: number
  startedAt: ISODate
  elapsedMs: number
  stats: {
    id: 'contributors' | 'participation' | 'commit_activity' | 'punch_card' | 'code_frequency'
    state: 'counting' | 'ready' | 'cached' | 'missing'
    landedAt?: ISODate
    cachedAt?: ISODate
  }[]
}
