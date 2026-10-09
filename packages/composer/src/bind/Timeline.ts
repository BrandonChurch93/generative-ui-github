import { isBot, windowSpan, type Commit, type Pull } from '@genui-github/data'
import { WINDOW_WORDS, type Timeline } from '@genui-github/ui/schemas'
import { bound, empty, unavailable, type Binder, type DataContext } from './types'

type TimelineModel = Timeline.TimelineModelProps
type Item = Timeline.TimelineItem

const COMPONENT = 'Timeline'
const DEFAULT_LIMIT = 6
const NOT_IN_DATA = "Not in this answer's data"

const t = (iso: string) => Date.parse(iso)
const firstLine = (message: string) => message.split('\n', 1)[0]!.trim() || message.trim()
const isRevert = (title: string) => /^revert\b/i.test(title)
/** "in the last 7 days", "in this week". */
const inWords = (words: string) => (words.startsWith('this') ? `in ${words}` : `in the ${words}`)
const sameLogin = (a: string | undefined, b: string | undefined) => a !== undefined && b !== undefined && a.toLowerCase() === b.toLowerCase()

function pullItem(p: Pull): Item {
  return { id: String(p.number), title: p.title, author: p.author.login, when: p.mergedAt!, add: p.additions, del: p.deletions, verb: isRevert(p.title) ? 'reverted' : 'merged', url: p.url }
}

function commitItem(ctx: DataContext, c: Commit): Item {
  const title = firstLine(c.message)
  return {
    id: c.sha.slice(0, 7),
    title,
    author: c.author?.login ?? 'unknown author',
    when: c.date,
    verb: isRevert(title) ? 'reverted' : 'committed',
    url: `https://github.com/${ctx.repo.owner}/${ctx.repo.name}/commit/${c.sha}`,
  }
}

interface Found {
  items: Item[]
  meta?: string
  empty: string
}

/** Merged pull requests on the scope, newest first: the day-grouped week when nothing narrows it, else the merged list. */
function merged(ctx: DataContext, props: TimelineModel): Found | null {
  const scope = props.scope ?? {}
  const author = scope.author ?? ctx.scope?.author
  const narrowed = scope.milestone !== undefined || author !== undefined
  const window = scope.window ?? (narrowed ? undefined : '7d')
  const byDay = ctx.shapes.mergedByDay
  let list: Pull[]
  if (!narrowed && byDay && window === byDay.window) list = byDay.days.flatMap(d => d.pulls)
  else if (ctx.shapes.pulls) {
    const span = window && window !== 'milestone' ? windowSpan(window, ctx.now) : null
    list = ctx.shapes.pulls.merged.filter(p => p.mergedAt !== null && t(p.mergedAt) <= ctx.now && (!span || (t(p.mergedAt) >= span.from && t(p.mergedAt) < span.to)))
  } else return null
  if (scope.milestone) list = list.filter(p => p.milestone === scope.milestone)
  if (author) list = list.filter(p => sameLogin(p.author.login, author))
  list = [...list].sort((a, b) => t(b.mergedAt!) - t(a.mergedAt!))

  const words = window ? WINDOW_WORDS[window] : undefined
  const by = author ? ` by ${author}` : ''
  const sentence = scope.milestone ? `Nothing${by} merged into ${scope.milestone} yet` : words ? `Nothing${by} merged ${inWords(words)}` : `Nothing${by} merged recently`
  return { items: list.map(pullItem), ...(words ? { meta: words } : {}), empty: sentence }
}

/** Commits between two refs from the release compare, or the default branch's recent commits, newest first. */
function commits(ctx: DataContext, props: TimelineModel): Found | null {
  const scope = props.scope ?? {}
  const author = scope.author ?? ctx.scope?.author
  const between = ctx.shapes.commitsBetweenTags
  const wantsRefs = scope.base !== undefined || scope.head !== undefined
  if (wantsRefs || (ctx.scope?.release && !scope.branch)) {
    if (!between) return null
    if ((scope.base && scope.base !== between.base) || (scope.head && scope.head !== between.head)) return null
    let list = [...between.commits]
    if (author) list = list.filter(c => sameLogin(c.author?.login, author))
    list.sort((a, b) => t(b.date) - t(a.date))
    return {
      items: list.map(c => commitItem(ctx, c)),
      meta: `${between.base} to ${between.head}`,
      empty: `No commits${author ? ` by ${author}` : ''} between ${between.base} and ${between.head}`,
    }
  }
  const recent = ctx.shapes.commits
  if (!recent) return null
  if (scope.branch && scope.branch !== ctx.repo.defaultBranch) return null
  const window = scope.window
  const span = window && window !== 'milestone' ? windowSpan(window, ctx.now) : { from: t(recent.since), to: ctx.now + 1 }
  let list = recent.commits.filter(c => t(c.date) >= span.from && t(c.date) < span.to)
  if (author) list = list.filter(c => sameLogin(c.author?.login, author))
  else list = list.filter(c => !c.author || !isBot(c.author))
  list.sort((a, b) => t(b.date) - t(a.date))
  const days = Math.round((ctx.now - t(recent.since)) / 86_400_000)
  const words = window ? WINDOW_WORDS[window] : `last ${days} days`
  return {
    items: list.map(c => commitItem(ctx, c)),
    meta: words,
    empty: `No commits${author ? ` by ${author}` : ''} ${inWords(words)}`,
  }
}

/**
 * Merged pull requests or commits, newest first, cut to the limit. The component groups them by day in the
 * viewer's zone, so the binder hands it the context's clock and zone.
 */
export const bindTimeline: Binder<TimelineModel> = (ctx, props, extras = {}) => {
  const found = props.kind === 'merged' ? merged(ctx, props) : commits(ctx, props)
  const base: Timeline.TimelineProps = {
    title: props.title,
    kind: props.kind,
    items: [],
    now: new Date(ctx.now).toISOString(),
    timeZone: ctx.timeZone,
    ...(props.dayAsk ? { dayAsk: props.dayAsk } : {}),
  }
  const meta = props.meta ?? found?.meta
  if (meta) base.meta = meta
  if (!found) {
    const failed = props.kind === 'merged' ? "Couldn't load merged pull requests" : "Couldn't load commits"
    return unavailable(COMPONENT, props, base, { failed, cause: NOT_IN_DATA }, extras)
  }
  const items = found.items.slice(0, props.limit ?? DEFAULT_LIMIT)
  if (!items.length) {
    return empty(COMPONENT, props, { ...base, emptyTone: props.emptyTone ?? 'neutral', empty: props.empty ?? found.empty }, extras)
  }
  return bound(COMPONENT, props, { ...base, items, ...(props.emptyTone ? { emptyTone: props.emptyTone } : {}) }, extras)
}
