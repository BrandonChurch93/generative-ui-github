import { computeMeasure, type Issue, type MeasureId, type MeasureResult, type ShapeMap, type ShapeName } from '@genui-github/data'
import type { Steps } from '@genui-github/ui/schemas'
import { bound, type Binder, type DataContext } from './types'

type Step = Steps.Step

const COMPONENT = 'Steps'
const LIMITS = { title: 40, body: 140, fact: 24, label: 28 }

const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`)

/** A measure the template asked for, or computed here from the shapes when it did not. */
function measure<Id extends MeasureId>(ctx: DataContext, id: Id): MeasureResult<Id> | null {
  const given = ctx.measures[id] as MeasureResult<Id> | null | undefined
  if (given !== undefined) return given
  const cachedAt = Object.fromEntries(Object.entries(ctx.shapes).map(([k, v]) => [k, (v as { cachedAt: string }).cachedAt])) as Partial<Record<ShapeName, string>>
  return computeMeasure(id, { now: ctx.now, shapes: ctx.shapes as Partial<ShapeMap>, cachedAt, ...(ctx.scope ? { scope: ctx.scope } : {}) })
}

function issueStep(ctx: DataContext, repoUrl: string): Step {
  const listed: Issue[] = ctx.shapes.goodFirstIssues?.issues ?? []
  const count = measure(ctx, 'good-first-issues')?.value ?? listed.length
  const search = `${repoUrl}/issues?q=${encodeURIComponent('is:issue is:open label:"good first issue"')}`
  const newest = listed[0]
  if (newest) {
    const second = listed[1]
    const body = second
      ? `Start with #${newest.number}, the newest one labeled for newcomers, or #${second.number} after it.`
      : `Start with #${newest.number}, the one open issue labeled for newcomers.`
    return {
      id: 'good-first-issue',
      title: 'Pick a good first issue',
      body: clip(body, LIMITS.body),
      ...(count > 0 ? { fact: `${count.toLocaleString('en-US')} open` } : {}),
      link: { label: clip(`Open #${newest.number}`, LIMITS.label), href: newest.url },
    }
  }
  if (count > 0) {
    return {
      id: 'good-first-issue',
      title: 'Pick a good first issue',
      body: 'Issues labeled good first issue or help wanted are the ones maintainers set aside for newcomers.',
      fact: `${count.toLocaleString('en-US')} open`,
      link: { label: 'Good first issues', href: search },
    }
  }
  return {
    id: 'good-first-issue',
    title: 'Find an issue to work on',
    body: 'No open issue is labeled good first issue or help wanted, so look through the open issues instead.',
    link: { label: 'Open issues', href: `${repoUrl}/issues` },
  }
}

function pullStep(ctx: DataContext): Step {
  const wait = measure(ctx, 'review-wait-median')
  const template = ctx.shapes.community?.files.pullRequestTemplate
  const lead = template ? 'Fill in the pull request template when you open it.' : 'Say in the description what you changed and why.'
  if (wait && Number.isFinite(wait.value)) {
    return {
      id: 'pull-request',
      title: 'Open a pull request',
      body: `${lead} Half of new pull requests get a first review within this time.`,
      fact: clip(`${wait.formatted.text}${wait.formatted.suffix ?? ''} median wait`, LIMITS.fact),
    }
  }
  return { id: 'pull-request', title: 'Open a pull request', body: `${lead} A maintainer reviews it from there.` }
}

/**
 * The new-contributor path, written by the system from the repo's own data: its README, its contributing
 * guide, its good first issues and its review wait. Always two to six steps, each within the schema's limits.
 */
export function systemSteps(ctx: DataContext): Steps.StepsModelProps {
  const repo = `${ctx.repo.owner}/${ctx.repo.name}`
  const repoUrl = `https://github.com/${repo}`
  const files = ctx.shapes.community?.files
  const readme = ctx.shapes.readme
  const steps: Step[] = []
  if (readme) {
    const path = readme.path.split('/').map(encodeURIComponent).join('/')
    steps.push({
      id: 'readme',
      title: 'Read the README',
      body: 'Start with what the project says about itself, before you read any of its code.',
      link: { label: 'README', href: `${repoUrl}/blob/${ctx.repo.defaultBranch}/${path}` },
    })
  }
  if (files?.contributing) {
    steps.push({
      id: 'contributing',
      title: 'Read the contributing guide',
      body: 'The repo keeps one. It says how changes are made here and what reviewers look for.',
      link: { label: 'How to contribute', href: `${repoUrl}/contribute` },
    })
  } else if (files) {
    steps.push({
      id: 'contributing',
      title: 'Ask before a large change',
      body: 'The repo has no contributing guide, so open an issue first and agree on the change with a maintainer.',
    })
  }
  if (files?.codeOfConduct) {
    steps.push({ id: 'code-of-conduct', title: 'Read the code of conduct', body: 'It sets how people treat each other in issues, reviews and discussions here.' })
  }
  steps.push(issueStep(ctx, repoUrl))
  steps.push(pullStep(ctx))
  return { title: 'Where to start', meta: repo, steps: steps.slice(0, 6) }
}

/** Steps binds nothing from data: it renders the steps it is given, which the system or the model wrote. */
export const bindSteps: Binder<Steps.StepsModelProps> = (_ctx, props, extras = {}) => bound(COMPONENT, props, { ...props } satisfies Steps.StepsProps, extras)
