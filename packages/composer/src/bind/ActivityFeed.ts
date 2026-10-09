import { isBot, windowSpan, type Issue, type Pull } from '@genui-github/data'
import { bound, empty, unavailable, type Binder } from './types'
import { during, missingData, ref, shape } from './group-a-shared'
import { ACTIVITY_COPY, DEFAULT_ACTIVITY_LIMIT, WINDOW_WORDS, type ActivityEvent, type ActivityFeedModelProps, type ActivityFeedProps } from './group-a-ui'

// ActivityFeed: the model names a scope and a limit; the system reads who did what from the listed pull
// requests and issues. Only events whose actor the data names are shown: a pull's opener and its reviewers,
// an issue's opener. Merges and releases are left out because no shape says who merged or who published.

const VERB = { APPROVED: 'approved', CHANGES_REQUESTED: 'changes', COMMENTED: 'reviewed' } as const

export const bindActivityFeed: Binder<ActivityFeedModelProps> = (ctx, props, extras = {}) => {
  const scope = props.scope ?? {}
  const window = scope.window ?? '7d'
  const { from, to } = windowSpan(window, ctx.now)
  const where = scope.milestone ? ` on ${scope.milestone}` : scope.pr ? ` on ${ref(scope.pr)}` : scope.author ? ` by ${scope.author}` : ''
  const frame: ActivityFeedProps = {
    title: where ? `Activity${where}` : ACTIVITY_COPY.title,
    meta: WINDOW_WORDS[window],
    items: [],
    now: new Date(ctx.now).toISOString(),
  }
  const pulls = shape(ctx, 'pulls')
  const issues = shape(ctx, 'issues')
  if (!pulls && !issues) return unavailable('ActivityFeed', props, frame, missingData(ctx, ACTIVITY_COPY.failed, ['pulls', 'issues']), extras)

  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
  const about = (x: Pull | Issue) =>
    (!scope.pr || x.number === scope.pr) &&
    (!scope.milestone || x.milestone === scope.milestone) &&
    (!scope.labels || x.labels.some(l => scope.labels!.some(s => same(l, s))))
  const inside = (iso: string) => Date.parse(iso) >= from && Date.parse(iso) <= to

  const events: ActivityEvent[] = []
  const seen = new Set<number>()
  for (const p of [...(pulls?.open ?? []), ...(pulls?.merged ?? [])]) {
    if (seen.has(p.number) || !about(p)) continue
    seen.add(p.number)
    const object = { kind: 'pull' as const, ref: ref(p.number), title: p.title }
    if (!isBot(p.author)) events.push({ id: `pull-${p.number}-opened`, actor: p.author.login, verb: 'opened', object, when: p.createdAt, url: p.url })
    for (const r of p.reviews) {
      if (isBot(r.author) || r.author.login === p.author.login || !(r.state in VERB)) continue
      events.push({ id: `pull-${p.number}-review-${r.author.login}-${r.submittedAt}`, actor: r.author.login, verb: VERB[r.state as keyof typeof VERB], object, when: r.submittedAt, url: p.url })
    }
  }
  const issueSeen = new Set<number>()
  for (const i of [...(issues?.open ?? []), ...(issues?.closed ?? [])]) {
    if (issueSeen.has(i.number) || !about(i) || isBot(i.author)) continue
    issueSeen.add(i.number)
    events.push({ id: `issue-${i.number}-opened`, actor: i.author.login, verb: 'opened', object: { kind: 'issue', ref: ref(i.number), title: i.title }, when: i.createdAt, url: i.url })
  }

  const items = events
    .filter(e => inside(e.when) && (!scope.author || same(e.actor, scope.author)))
    .sort((a, b) => Date.parse(b.when) - Date.parse(a.when) || a.id.localeCompare(b.id))
    .slice(0, props.limit ?? DEFAULT_ACTIVITY_LIMIT)
  if (!items.length) return empty('ActivityFeed', props, { ...frame, empty: `Nothing happened${where} ${during(WINDOW_WORDS[window])}`, emptyTone: 'neutral' }, extras)
  return bound('ActivityFeed', props, { ...frame, items } satisfies ActivityFeedProps, extras)
}
