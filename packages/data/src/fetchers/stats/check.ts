import { createLogger } from '@genui-github/core'
import { cacheKey, LIVE_TTL_SECONDS, type Cache } from '../../cache/cache'
import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { Cached, PunchCardShape, ShapeMap, WarmingStatus } from '../../shapes'
import { fetchCodeFrequency, UNAVAILABLE, type Unavailable } from './codeFrequency'
import { fetchCommitActivity } from './commitActivity'
import { fetchContributorsStat } from './contributors'
import { fetchParticipation } from './participation'
import { fetchPunchCard, punchCardInZone } from './punchCard'
import { COUNTING, type Counting } from './request'
import { checksDue, CHECKS, msUntilNextCheck } from './schedule'

const log = createLogger('data:stats')

export type StatId = WarmingStatus['stats'][number]['id']
type StatLane = WarmingStatus['stats'][number]

/** The WarmingStatus id for each stats shape. */
export const STAT_ID = {
  'stats.contributors': 'contributors',
  'stats.participation': 'participation',
  'stats.commitActivity': 'commit_activity',
  'stats.punchCard': 'punch_card',
  'stats.codeFrequency': 'code_frequency',
} as const satisfies Record<Extract<keyof ShapeMap, `stats.${string}`>, StatId>

export type StatShapeName = keyof typeof STAT_ID

export const STAT_SHAPE = Object.fromEntries(Object.entries(STAT_ID).map(([shape, id]) => [id, shape])) as Record<StatId, StatShapeName>

export type StatsData = { [K in StatShapeName]?: Cached<ShapeMap[K]> }

/**
 * The newest copy of each stat for any SHA, kept under the stats key with this in place of a SHA. It is what
 * a stopped check shows, dated, when GitHub is still counting the current head.
 */
export const LAST_COPY = 'last-copy'
/** How long the last copy outlives the SHA-keyed one for a live repo. */
export const LAST_COPY_TTL_SECONDS = 30 * 24 * 60 * 60

export interface CheckOptions {
  now?: () => number
  cache?: Cache
  /** The default-branch SHA. Without it the SHA-keyed cache is skipped, and only the last copy is read and written. */
  sha?: string
  /** The viewer's IANA zone for the punch card. */
  timeZone?: string
  /** TTL of the SHA-keyed entry: 900s for a live repo, null for a sample repo. */
  ttlSeconds?: number | null
  /** Answer from the cache alone (a sample repo): a stat not there is missing, and GitHub is never asked. */
  offline?: boolean
}

export interface StatsCheck {
  /** Null when every stat asked for has data and nothing is warming. */
  status: WarmingStatus | null
  /** Every stat with data now: ready, or a dated cached copy after checking stopped. */
  data: StatsData
  /** Stats GitHub will never count for this repo (code frequency at 10,000+ commits). No lane; the pieces they feed are left out. */
  unavailable: StatShapeName[]
}

const FETCH: { [K in StatShapeName]: (client: GitHubClient, repo: RepoRef) => Promise<ShapeMap[K] | Counting | Unavailable> } = {
  'stats.contributors': fetchContributorsStat,
  'stats.participation': fetchParticipation,
  'stats.commitActivity': fetchCommitActivity,
  // Fetched and cached in UTC, shifted into the viewer's zone on the way out, so one copy serves every zone.
  'stats.punchCard': (client, repo) => fetchPunchCard(client, repo, 'UTC'),
  'stats.codeFrequency': fetchCodeFrequency,
}

type Outcome =
  | { state: 'ready'; value: unknown; cachedAt: string; landedAt: string }
  | { state: 'cached'; value: unknown; cachedAt: string }
  | { state: 'counting' | 'missing' | 'unavailable' }

/**
 * One check on the schedule, driven by the caller: a serverless route cannot wait two minutes, so the caller
 * calls again `status.nextCheckMs` from now with the status it got. Only stats not yet in the cache go to GitHub.
 * Without `previous`, or with a stopped one or another repo's, this is the first check of a new run.
 */
export async function checkStats(
  client: GitHubClient,
  repo: RepoRef,
  shapes: readonly StatShapeName[],
  previous?: WarmingStatus | null,
  options: CheckOptions = {},
): Promise<StatsCheck> {
  const { cache, sha, timeZone = 'UTC', ttlSeconds = LIVE_TTL_SECONDS } = options
  const now = (options.now ?? Date.now)()
  const at = new Date(now).toISOString()
  const name = `${repo.owner}/${repo.name}`
  const run =
    previous?.phase === 'warming' && previous.repo.toLowerCase() === name.toLowerCase() && Number.isFinite(Date.parse(previous.startedAt))
      ? previous
      : null
  const startedAt = run?.startedAt ?? at
  const elapsedMs = Math.max(0, Math.round(now - Date.parse(startedAt)))
  // A caller that comes back late (a sleeping tab) skips the checks it missed rather than replaying them.
  const attempt = run ? Math.min(CHECKS, Math.max(run.attempt + 1, checksDue(elapsedMs))) : 1
  const last = attempt === CHECKS || options.offline === true
  const lastCopyTtl = ttlSeconds === null ? null : LAST_COPY_TTL_SECONDS

  async function check(shape: StatShapeName): Promise<Outcome> {
    const before = run?.stats.find(s => s.id === STAT_ID[shape])
    const landedAt = (before?.state === 'ready' && before.landedAt) || at
    if (cache && sha) {
      const hit = await cache.get(cacheKey.stats(repo, sha, shape))
      if (hit) return { state: 'ready', value: hit.value, cachedAt: hit.cachedAt, landedAt }
    }
    if (options.offline) {
      const copy = cache ? await cache.get(cacheKey.stats(repo, LAST_COPY, shape)) : null
      return copy ? { state: 'cached', value: copy.value, cachedAt: copy.cachedAt } : { state: 'missing' }
    }
    const result = await FETCH[shape](client, repo)
    if (result === UNAVAILABLE) return { state: 'unavailable' }
    if (result !== COUNTING) {
      if (cache && sha) await cache.set(cacheKey.stats(repo, sha, shape), result, ttlSeconds)
      if (cache) await cache.set(cacheKey.stats(repo, LAST_COPY, shape), result, lastCopyTtl)
      return { state: 'ready', value: result, cachedAt: at, landedAt }
    }
    if (!last) return { state: 'counting' }
    const copy = cache ? await cache.get(cacheKey.stats(repo, LAST_COPY, shape)) : null
    return copy ? { state: 'cached', value: copy.value, cachedAt: copy.cachedAt } : { state: 'missing' }
  }

  const wanted = [...new Set(shapes)]
  const outcomes = await Promise.all(wanted.map(check))

  const data: Record<string, unknown> = {}
  const lanes: StatLane[] = []
  const unavailable: StatShapeName[] = []
  wanted.forEach((shape, i) => {
    const outcome = outcomes[i]!
    if (outcome.state === 'unavailable') {
      unavailable.push(shape)
      return
    }
    const id = STAT_ID[shape]
    if (outcome.state === 'ready' || outcome.state === 'cached') {
      const value = shape === 'stats.punchCard' ? punchCardInZone(outcome.value as PunchCardShape, timeZone, now) : outcome.value
      data[shape] = { ...(value as object), cachedAt: outcome.cachedAt }
    }
    if (outcome.state === 'ready') lanes.push({ id, state: 'ready', landedAt: outcome.landedAt })
    else if (outcome.state === 'cached') lanes.push({ id, state: 'cached', cachedAt: outcome.cachedAt })
    else lanes.push({ id, state: outcome.state })
  })

  const settled = lanes.every(l => l.state === 'ready')
  log.debug('Stats check', { repo: name, attempt, elapsedMs, counting: lanes.filter(l => l.state === 'counting').length })
  const status: WarmingStatus | null = settled
    ? null
    : { repo: name, phase: last ? 'stopped' : 'warming', attempt, nextCheckMs: msUntilNextCheck(attempt, elapsedMs), startedAt, elapsedMs, stats: lanes }
  return { status, data: data as StatsData, unavailable }
}
