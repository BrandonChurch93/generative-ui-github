import type { Cache, DatedCache, GitHubClient } from '@genui-github/data/server'
import type { ComposeDeps } from './compose'
import { dayOf } from './limits'

// `/api/health` (docs/plan.md 9.2): how the cache is doing, what the models cost today, and how much of
// GitHub's hourly allowance is left. Nothing about a visitor.

export interface CacheCounts {
  hits: number
  misses: number
  /** When this server instance started counting: serverless instances each count their own. */
  since: string
}

/** The cache, counting its reads. A hit is any read that found an entry. */
export function countedCache<C extends DatedCache>(cache: C, now: () => number = Date.now): C & { counts(): CacheCounts } {
  const counts = { hits: 0, misses: 0 }
  const since = new Date(now()).toISOString()
  const get: C['get'] = async key => {
    const found = await cache.get(key)
    if (found) counts.hits += 1
    else counts.misses += 1
    return found as never
  }
  return Object.assign(Object.create(cache) as C, { get, counts: () => ({ ...counts, since }) })
}

export interface Health {
  cache: CacheCounts & { hitRate: number | null }
  modelCallsToday: number
  spendTodayUsd: number
  dailyCapUsd: number
  /** REST (`core`) and GraphQL are separate allowances; the data layer spends both. */
  github: { rest: Allowance; graphql: Allowance | null } | { error: string }
}

interface Allowance {
  remaining: number
  limit: number
  resetAt: string
}

type Window = { limit: number; remaining: number; reset: number }

interface RateLimitResponse {
  resources: { core: Window; graphql?: Window }
}

const allowance = (w: Window): Allowance => ({ remaining: w.remaining, limit: w.limit, resetAt: new Date(w.reset * 1000).toISOString() })

export async function health(deps: Pick<ComposeDeps, 'limits' | 'dailyCapUsd'> & { cache: Cache & { counts?: () => CacheCounts }; github: GitHubClient }, now = Date.now()): Promise<Health> {
  const day = dayOf(now)
  const counts = deps.cache.counts?.() ?? { hits: 0, misses: 0, since: new Date(now).toISOString() }
  const reads = counts.hits + counts.misses
  let github: Health['github']
  try {
    // /rate_limit is free: GitHub does not count it against the allowance it reports.
    const { data } = await deps.github.rest<RateLimitResponse>('GET /rate_limit')
    github = { rest: allowance(data.resources.core), graphql: data.resources.graphql ? allowance(data.resources.graphql) : null }
  } catch (error) {
    github = { error: `Couldn't read GitHub's rate limit · ${(error as Error).message}` }
  }
  return {
    cache: { ...counts, hitRate: reads ? Number((counts.hits / reads).toFixed(3)) : null },
    modelCallsToday: await deps.limits.calls(day),
    spendTodayUsd: Number((await deps.limits.spend(day)).toFixed(6)),
    dailyCapUsd: deps.dailyCapUsd,
    github,
  }
}
