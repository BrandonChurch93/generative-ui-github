import type { MeasureId, MeasureScope, ShapeName } from '@genui-github/data'

// What each template reads, from docs/golden-questions.md. No compose logic: the data context builder
// fetches exactly these shapes and computes exactly these measures, and nothing else.

export const TEMPLATE_IDS = [
  'overview',
  'release-blockers',
  'contributors',
  'ci-trend',
  'merged-recent',
  'stale-issues',
  'biggest-pr',
  'new-contributor',
  'responsiveness',
  'month-compare',
  'punch-card',
  'release-diff',
  'check-failures',
  'pr-detail',
  'person',
] as const
export type TemplateId = (typeof TEMPLATE_IDS)[number]

export interface TemplateNeeds {
  /** The golden question it answers, or the click that reaches it. */
  question: string
  kind: 'golden' | 'follow-up'
  shapes: ShapeName[]
  measures: MeasureId[]
  /** What the measures are about, when it is narrower than the whole repo. */
  scope?: keyof MeasureScope
}

export const TEMPLATE_NEEDS: Record<TemplateId, TemplateNeeds> = {
  overview: {
    question: "How's this repo doing?",
    kind: 'golden',
    shapes: ['repo', 'pulls', 'issues', 'community', 'stats.commitActivity', 'stats.contributors'],
    measures: ['open-prs', 'prs-merged', 'review-wait-median', 'contributors'],
  },
  'release-blockers': {
    question: "What's blocking the next release?",
    kind: 'golden',
    shapes: ['repo', 'pulls', 'issues', 'milestones', 'checks', 'workflowRuns', 'blockingPrs', 'ciDurationByWeek'],
    measures: ['open-prs', 'awaiting-review', 'failing-checks', 'milestone-issues-open', 'milestone-closes', 'ci-p50'],
  },
  contributors: {
    question: "Who's carrying this repo?",
    kind: 'golden',
    shapes: ['repo', 'pulls', 'stats.contributors', 'stats.participation', 'stats.punchCard', 'contributorShare'],
    measures: ['contributors', 'bus-factor', 'core-share', 'community-share'],
  },
  'ci-trend': {
    question: 'Is CI getting slower?',
    kind: 'golden',
    shapes: ['repo', 'workflowRuns', 'runTiming', 'ciDurationByWeek', 'failureRateByWeek', 'slowestJob', 'monthCompare'],
    measures: ['ci-p50', 'ci-p90', 'failing-check-rate', 'slowest-job', 'flaky-rate'],
  },
  'merged-recent': {
    question: "What's been merged this week?",
    kind: 'golden',
    shapes: ['repo', 'pulls', 'mergedByDay', 'stats.contributors'],
    measures: ['prs-merged', 'contributors'],
  },
  'stale-issues': {
    question: 'Which issues have gone stale?',
    kind: 'golden',
    shapes: ['repo', 'pulls', 'issues', 'staleIssues'],
    measures: ['stale-issues', 'time-to-close-median'],
  },
  'biggest-pr': {
    question: 'Show me the biggest open PR',
    kind: 'golden',
    shapes: ['repo', 'pulls', 'biggestOpenPr', 'prFiles', 'checks'],
    measures: ['pr-size', 'files-changed', 'review-wait-median'],
  },
  'new-contributor': {
    question: 'Where would a new contributor start?',
    kind: 'golden',
    shapes: ['repo', 'readme', 'community', 'issues', 'goodFirstIssues', 'pulls', 'stats.contributors'],
    measures: ['good-first-issues', 'review-wait-median', 'first-time-contributors'],
  },
  responsiveness: {
    question: 'How responsive are the maintainers?',
    kind: 'golden',
    shapes: ['repo', 'pulls', 'issues', 'activity', 'contributorShare'],
    measures: ['review-wait-median', 'review-wait-p90', 'closure-ratio', 'time-to-close-median'],
  },
  'month-compare': {
    question: 'Compare this month to last',
    kind: 'golden',
    shapes: ['repo', 'pulls', 'issues', 'workflowRuns', 'monthCompare'],
    measures: ['prs-merged', 'review-wait-median', 'failing-check-rate', 'time-to-close-median'],
  },
  'punch-card': {
    question: 'When does this project get worked on?',
    kind: 'golden',
    shapes: ['repo', 'stats.commitActivity', 'stats.punchCard', 'busiestHour', 'quietestDay'],
    measures: ['busiest-hour', 'quietest-day', 'commits'],
  },
  'release-diff': {
    question: 'What changed between the last two releases?',
    kind: 'golden',
    shapes: ['repo', 'releases', 'compare', 'commitsBetweenTags'],
    measures: ['commits', 'contributors', 'files-changed'],
    scope: 'release',
  },
  'check-failures': {
    question: 'Which checks are failing on <branch>?',
    kind: 'follow-up',
    shapes: ['repo', 'checks', 'workflowRuns', 'ciDurationByWeek'],
    measures: ['failing-checks', 'failing-since', 'ci-p50', 'flaky-rate'],
  },
  'pr-detail': {
    question: "What's holding #<n>?",
    kind: 'follow-up',
    shapes: ['repo', 'pulls', 'prFiles', 'checks'],
    measures: ['pr-size', 'files-changed', 'review-wait-median'],
    scope: 'pr',
  },
  person: {
    question: 'What has <handle> been working on?',
    kind: 'follow-up',
    shapes: ['repo', 'pulls', 'commits'],
    measures: ['prs-merged', 'commits', 'open-prs'],
    scope: 'author',
  },
}
