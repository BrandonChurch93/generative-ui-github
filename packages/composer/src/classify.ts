import { z } from 'zod'
import { MODELS } from '@genui-github/core'
import type { CallUsage, ModelClient } from './anthropic'
import { TEMPLATE_IDS, type TemplateId } from './templates/needs'

// The classifier (docs/composer.md): one Haiku call picks a template or says off-template.

/** Below this the question goes to Sonnet: a wrong template answers the wrong question confidently. */
export const MIN_CONFIDENCE = 0.6

const LINES: Record<TemplateId, string> = {
  overview: 'general health of the repo: how it is doing, is it active, a quick summary',
  'release-blockers': 'what is holding up the next release or milestone: blocking PRs, failing checks, the due date',
  contributors: 'who does the work, how concentrated it is, the bus factor, core vs community',
  'ci-trend': 'whether CI is getting slower or failing more over the weeks',
  'merged-recent': 'what was merged recently, this week, on a given day, or around a given hour',
  'stale-issues': 'issues (or PRs) left untouched, open lists that need attention, adding labels',
  'biggest-pr': 'the largest open pull request and its diff',
  'new-contributor': 'where a newcomer should start: good first issues, contributing guide, first steps',
  responsiveness: 'how fast maintainers respond or review, time to first response, time to close, closure ratio',
  'month-compare': 'this month compared with last month',
  'punch-card': 'when work happens: hours and weekdays of commits',
  'release-diff': 'what changed between the last two releases or tags',
  'check-failures': 'a follow-up about which checks or workflows are failing on a branch',
  'pr-detail': 'a follow-up about one specific pull request by number',
  person: 'a follow-up about what one person (by handle) has been working on',
}

const SYSTEM = [
  'You route questions about a public GitHub repo to one of these answer templates, or to off-template.',
  '',
  ...TEMPLATE_IDS.map(id => `${id}: ${LINES[id]}`),
  '',
  'Rules:',
  '- A question about one specific pull request number is pr-detail; about one person or handle is person; about which checks fail on a branch is check-failures.',
  '- A question about a specific day or hour of merges is merged-recent, with the day or hour in params.',
  '- Pick the template whose answer the question is asking for, even when worded casually.',
  '- A template is right only when its screen answers the measure the question asks about. A question about the same topic but a different cut is off-template: a breakdown no template draws (by kind or area of pull request, by reviewer, by weekday for one workflow, an average per pull request), or a measure a template does not show. Sharing a topic is not enough.',
  '- A request to see or list open pull requests or issues (often a click on a figure in an answer, such as "Show me the N open PRs") is stale-issues, the open-list screen.',
  '- Return off-template when no template answers the question, including anything about traffic, views, clones or stars over time, and give your confidence honestly. Under 0.6 means off-template.',
  '- params: fill only what the question names (a PR number, a handle, a branch, a window like 7d or 30d, a day, a weekday, an hour 0 to 23). Leave the rest null.',
].join('\n')

export const classificationSchema = z.object({
  template: z.enum([...TEMPLATE_IDS, 'off-template'] as [TemplateId | 'off-template', ...(TemplateId | 'off-template')[]]),
  confidence: z.number(),
  params: z.object({
    pr: z.number().int().nullable(),
    handle: z.string().nullable(),
    branch: z.string().nullable(),
    window: z.string().nullable(),
    day: z.string().nullable(),
    weekday: z.string().nullable(),
    hour: z.number().int().nullable(),
  }),
})
export type Classification = z.infer<typeof classificationSchema>

/** The repo in one line, as the classifier reads it. */
export interface RepoSummary {
  repo: string
  language: string | null
  stars: number
  openPulls: number | null
  openIssues: number
  pushedAt: string
}

export interface ClassifyInput {
  question: string
  summary: RepoSummary
  /** The piece a click came from, when the question is a follow-up. */
  from?: { id: string; ask: string }
}

const OFF: Classification = { template: 'off-template', confidence: 0, params: { pr: null, handle: null, branch: null, window: null, day: null, weekday: null, hour: null } }

export function classifyPrompt(input: ClassifyInput): string {
  const s = input.summary
  const lines = [
    `Question: ${input.question}`,
    `Repo: ${s.repo} · ${s.language ?? 'no main language'} · ${s.stars} stars · ${s.openPulls ?? 'unknown'} open PRs · ${s.openIssues} open issues · last push ${s.pushedAt.slice(0, 10)}`,
  ]
  if (input.from) lines.push(`Asked by clicking: ${input.from.id}`)
  return lines.join('\n')
}

export async function classify(client: ModelClient, input: ClassifyInput): Promise<{ result: Classification; usage: CallUsage }> {
  const { value, usage } = await client.json({
    model: MODELS.haiku,
    cachedSystem: SYSTEM,
    user: classifyPrompt(input),
    schema: classificationSchema,
    maxTokens: 1024,
    effort: 'low',
  })
  if (!value) return { result: OFF, usage }
  const result = value.template !== 'off-template' && value.confidence < MIN_CONFIDENCE ? { ...value, template: 'off-template' as const } : value
  return { result, usage }
}
