import { isBot, windowSpan } from '@genui-github/data'
import { bound, empty, unavailable, type Binder, type DataContext } from './types'
import { missingData, shape } from './group-a-shared'
import { DEFAULT_PERSON_LIMIT, PERSON_WORDS, WINDOW_WORDS, type ListedPerson, type PersonListModelProps, type PersonListProps } from './group-a-ui'

// PersonList: the model picks commits, reviews or issues; the system reads who did the most, one count each.

/** Issue authors read the listed issues only (the most and least recently updated), so they cover a shorter window. */
const ISSUE_WINDOW = '30d' as const

function issueAuthors(ctx: DataContext): { counts: { login: string; count: number }[]; meta: string } | null {
  const issues = shape(ctx, 'issues')
  if (!issues) return null
  const { from } = windowSpan(ISSUE_WINDOW, ctx.now)
  const byNumber = new Map([...issues.open, ...issues.closed].map(i => [i.number, i]))
  const counts = new Map<string, number>()
  for (const i of byNumber.values()) {
    if (isBot(i.author) || Date.parse(i.createdAt) < from) continue
    counts.set(i.author.login, (counts.get(i.author.login) ?? 0) + 1)
  }
  return { counts: [...counts].map(([login, count]) => ({ login, count })), meta: `${WINDOW_WORDS[ISSUE_WINDOW]} · listed issues` }
}

export const bindPersonList: Binder<PersonListModelProps> = (ctx, props, extras = {}) => {
  const words = PERSON_WORDS[props.measure]
  const frame: PersonListProps = { measure: props.measure, people: [], ...(props.limit ? { limit: props.limit } : {}) }
  let read: { counts: { login: string; count: number }[]; meta: string } | null
  if (props.measure === 'issues') read = issueAuthors(ctx)
  else {
    const share = shape(ctx, 'contributorShare')
    read = share ? { counts: share[props.measure].map(w => ({ login: w.author.login, count: w.count })), meta: WINDOW_WORDS[share.window] } : null
  }
  if (!read) {
    const needs = props.measure === 'issues' ? (['issues'] as const) : (['contributorShare', 'stats.contributors', 'pulls'] as const)
    return unavailable('PersonList', props, frame, missingData(ctx, `Couldn't load ${words.loading}`, needs), extras)
  }

  const people = read.counts
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count || a.login.localeCompare(b.login))
    .slice(0, props.limit ?? DEFAULT_PERSON_LIMIT)
    .map((c): ListedPerson => ({ handle: c.login, count: c.count, ask: words.ask(c.login), url: `https://github.com/${c.login}` }))
  if (!people.length) return empty('PersonList', props, { ...frame, meta: read.meta, empty: words.empty, emptyTone: 'neutral' }, extras)
  return bound('PersonList', props, { ...frame, meta: read.meta, people } satisfies PersonListProps, extras)
}
