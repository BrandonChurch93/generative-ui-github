import type { Person } from '@genui-github/data'
import { ContributorRank } from '@genui-github/ui/schemas'
import { bound, empty, unavailable, type Binder, type DataContext } from './types'
import { agoWords, missingCause } from './group-b-ui'

type ContributorRankModel = ContributorRank.ContributorRankModelProps
type ContributorRankBound = ContributorRank.ContributorRankProps
type RankPerson = ContributorRank.RankPerson
const { RANK_COPY, RANK_WORDS } = ContributorRank

const COMPONENT = 'ContributorRank'
const DAY = 86_400_000
const RANK_DAYS = 90
const t = (iso: string) => Date.parse(iso)

const latest = (map: Map<string, number>, login: string, at: number) => map.set(login, Math.max(map.get(login) ?? 0, at))

/**
 * Each person's latest work in the window, exact where a list holds it: the commit list for commits, the
 * reviews on merged pull requests for reviews. A commit author outside the list gets the last week the stats
 * count them in, which only breaks a tie and earns no "last commit" line.
 */
function lastWork(ctx: DataContext, measure: ContributorRankModel['measure']): { exact: Map<string, number>; weekly: Map<string, number> } {
  const exact = new Map<string, number>()
  const weekly = new Map<string, number>()
  const since = ctx.now - RANK_DAYS * DAY
  if (measure === 'commits') {
    for (const c of ctx.shapes.commits?.commits ?? []) if (c.author && t(c.date) >= since) latest(exact, c.author.login, t(c.date))
    for (const a of ctx.shapes['stats.contributors']?.authors ?? []) for (const w of a.weeks) if (w.commits > 0) latest(weekly, a.author.login, t(w.weekStart))
  } else {
    for (const p of ctx.shapes.pulls?.merged ?? []) {
      if (!p.mergedAt || t(p.mergedAt) < since) continue
      for (const r of p.reviews) if (r.author.login !== p.author.login && t(r.submittedAt) >= since) latest(exact, r.author.login, t(r.submittedAt))
    }
  }
  return { exact, weekly }
}

export const bindContributorRank: Binder<ContributorRankModel> = (ctx, props, extras) => {
  const words = RANK_WORDS[props.measure]
  const base: ContributorRankBound = { ...props, people: [] }
  const share = ctx.shapes.contributorShare
  if (!share) return unavailable(COMPONENT, props, base, { failed: `Couldn't load ${words.loading}`, cause: missingCause(ctx, ['stats.contributors', 'pulls']) }, extras)

  const { exact, weekly } = lastWork(ctx, props.measure)
  const person = ({ author, count }: { author: Person; count: number }): RankPerson => {
    const at = exact.get(author.login)
    const week = weekly.get(author.login)
    return {
      handle: author.login,
      count,
      ...(at !== undefined ? { lastActive: new Date(at).toISOString(), lastWords: `last ${words.shortOne} ${agoWords(at, ctx.now)}` } : week !== undefined ? { lastActive: new Date(week).toISOString() } : {}),
      ask: words.ask(author.login),
    }
  }
  const people = share[props.measure].filter(w => w.count > 0).map(person)
  if (!people.length) return empty(COMPONENT, props, { ...base, emptyTone: props.emptyTone ?? 'neutral', empty: props.empty ?? RANK_COPY.empty }, extras)
  return bound(COMPONENT, props, { ...base, people }, extras)
}
