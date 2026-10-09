import { isBot, nextMilestone, type CommunityShape } from '@genui-github/data'
import { bound, empty, unavailable, type Binder, type DataContext } from './types'
import { missingData, ref, shape, shortDate } from './group-a-shared'
import type { ChecklistItem, ChecklistModelProps, ChecklistProps } from './group-a-ui'

// Checklist: the model picks a source; the system reads the yes/no checks from the data and words them.

const MAX_ITEMS = 8

const STANDARDS: { id: string; file: keyof CommunityShape['files']; title: string }[] = [
  { id: 'readme', file: 'readme', title: 'README' },
  { id: 'license', file: 'license', title: 'License' },
  { id: 'contributing', file: 'contributing', title: 'Contributing guide' },
  { id: 'code-of-conduct', file: 'codeOfConduct', title: 'Code of conduct' },
  { id: 'issue-template', file: 'issueTemplate', title: 'Issue templates' },
  { id: 'pr-template', file: 'pullRequestTemplate', title: 'Pull request template' },
]

type Read = { items: ChecklistItem[]; meta?: string; emptyMeta?: string } | { failed: string; cause: string }

function communityStandards(ctx: DataContext): Read {
  const community = shape(ctx, 'community')
  if (!community) return missingData(ctx, "Couldn't load the community profile", ['community'])
  const license = shape(ctx, 'repo')?.license
  const url = `https://github.com/${ctx.repo.owner}/${ctx.repo.name}/community`
  const items = STANDARDS.map(({ id, file, title }): ChecklistItem => {
    const passed = community.files[file]
    const meta = !passed ? 'not in the repo or .github' : id === 'license' && license ? license : 'found by GitHub'
    return { id, title, meta, passed, url }
  })
  return { items, meta: `GitHub community profile · ${community.healthPercentage}% health` }
}

function milestone(ctx: DataContext): Read {
  const milestones = shape(ctx, 'milestones')
  if (!milestones) return missingData(ctx, "Couldn't load the milestone", ['milestones'])
  const m = nextMilestone(milestones)
  if (!m) return { failed: "Couldn't load the milestone", cause: 'This repo has no open milestone with a due date' }
  const pulls = shape(ctx, 'pulls')
  const issues = shape(ctx, 'issues')
  const on = <T extends { milestone: string | null; author: { login: string; isBot: boolean } }>(list: T[] | undefined) => (list ?? []).filter(x => x.milestone === m.title && !isBot(x.author))
  const open = [...on(pulls?.open), ...on(issues?.open)].map((x): ChecklistItem => ({ id: String(x.number), title: x.title, meta: `${ref(x.number)} · ${x.author.login}`, passed: false, url: x.url }))
  const closed = on(issues?.closed).map(
    (x): ChecklistItem => ({ id: String(x.number), title: x.title, meta: `${ref(x.number)} · ${x.author.login}${x.closedAt ? ` · closed ${shortDate(x.closedAt, ctx.timeZone)}` : ''}`, passed: true, url: x.url }),
  )
  const due = m.dueOn ? `due ${shortDate(m.dueOn, ctx.timeZone)} · ` : ''
  return {
    items: [...open, ...closed].slice(0, MAX_ITEMS),
    meta: `${m.title} · ${due}${m.closed} of ${m.open + m.closed} closed`,
    emptyMeta: m.open + m.closed ? `${m.open + m.closed} items on ${m.title} · none in the listed issues and pull requests` : 'no issues or pull requests yet',
  }
}

export const bindChecklist: Binder<ChecklistModelProps> = (ctx, props, extras = {}) => {
  const frame: ChecklistProps = { title: props.title, source: props.source, items: [] }
  const read: Read =
    props.source === 'community-standards'
      ? communityStandards(ctx)
      : props.source === 'milestone'
        ? milestone(ctx)
        : { failed: "Couldn't load a release checklist", cause: "GitHub keeps no release checklist this answer's data can read" }
  if ('failed' in read) return unavailable('Checklist', props, frame, read, extras)
  const boundProps: ChecklistProps = { ...frame, items: read.items, ...(read.meta ? { meta: read.meta } : {}) }
  if (!read.items.length) return empty('Checklist', props, { ...boundProps, ...(read.emptyMeta ? { emptyMeta: read.emptyMeta } : {}) }, extras)
  return bound('Checklist', props, boundProps, extras)
}
