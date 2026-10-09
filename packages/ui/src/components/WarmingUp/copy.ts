import { COPY, STATS, type StatId, type StatState, type WarmingUpProps } from './schema'

type Stat = WarmingUpProps['stats'][number]

/**
 * The fifth check lands at 28s, just after the axis first doubles. Before it, a wait reads as a first visit;
 * from it on, the lead says a long history can take a minute or two.
 */
export const RETRY_FROM_ATTEMPT = 5

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
export const dateWords = (iso: string) => dateFormat.format(new Date(iso))

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** The moment the status describes. Ages are measured from it, not from the viewer's clock, so they never drift. */
export const statusNow = (p: Pick<WarmingUpProps, 'startedAt' | 'elapsedMs'>) => Date.parse(p.startedAt) + p.elapsedMs

/** "3 days ago", "yesterday", "5 hours ago". */
export function ageWords(iso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000))
  if (minutes < 2) return 'a minute ago'
  if (minutes < 60) return `${minutes} minutes ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

const named = (stats: Stat[]) => joinNames(stats.map(s => STATS[s.id as StatId].inSentence))
const by = (p: WarmingUpProps, state: StatState) => p.stats.filter(s => s.state === state)

/** One age for every cached copy, or null when they were counted at different times. */
function sharedAge(cached: Stat[], now: number): string | null {
  const ages = new Set(cached.map(s => (s.cachedAt ? ageWords(s.cachedAt, now) : '')))
  const [only] = [...ages]
  return ages.size === 1 && only ? only : null
}

/** The lead: one sentence in the Insight's slot, then what is happening and how long it usually takes. */
export function leadCopy(p: WarmingUpProps): { say: string; why: string } {
  if (p.phase === 'stopped') {
    const now = statusNow(p)
    const cached = by(p, 'cached')
    const missing = by(p, 'missing')
    const parts: string[] = []
    if (cached.length === 1) parts.push(COPY.cachedOne(capital(named(cached)), cached[0]?.cachedAt ? ageWords(cached[0].cachedAt, now) : 'earlier'))
    else if (cached.length > 1) parts.push(COPY.cachedMany(capital(named(cached)), sharedAge(cached, now)))
    if (missing.length === 1) parts.push(COPY.missingOne(capital(named(missing))))
    else if (missing.length > 1) parts.push(COPY.missingMany(capital(named(missing))))
    return { say: COPY.stoppedSay(p.repo), why: parts.join(' ') }
  }
  const counting = by(p, 'counting')
  const landed = p.stats.filter(s => s.state !== 'counting')
  if (!landed.length) {
    return p.attempt >= RETRY_FROM_ATTEMPT
      ? { say: COPY.retrySay(p.repo), why: COPY.retryWhy }
      : { say: COPY.firstSay(p.repo), why: COPY.firstWhy }
  }
  if (!counting.length) return { say: COPY.doneSay(p.repo), why: COPY.doneWhy }
  return { say: COPY.partlySay(named(counting)), why: COPY.partlyWhy(capital(named(landed)), landed.length > 1) }
}

/** The meta line under the lead: the attempt and a countdown to the next check, or how checking ended. */
export function whenWords(p: WarmingUpProps, secondsLeft: number): string {
  return p.phase === 'stopped' ? COPY.stoppedWhen(p.attempt) : COPY.when(p.attempt, secondsLeft)
}

/** The one polite status line. It speaks on arrival, on each landing and on stop, never every second. */
export function spokenCopy(p: WarmingUpProps): string {
  const seconds = Math.max(1, Math.ceil(p.nextCheckMs / 1000))
  if (p.phase === 'stopped') {
    const now = statusNow(p)
    const cached = by(p, 'cached')
    const missing = by(p, 'missing')
    const parts: string[] = [COPY.stoppedSpoken]
    if (cached.length) {
      const age = cached.length === 1 ? (cached[0]?.cachedAt ? ageWords(cached[0].cachedAt, now) : 'earlier') : sharedAge(cached, now)
      parts.push(COPY.cachedSpoken(capital(named(cached)), cached.length > 1, age))
    }
    if (missing.length) parts.push(COPY.missingSpoken(capital(named(missing)), missing.length > 1))
    return parts.join(' ')
  }
  const landed = p.stats.filter(s => s.state !== 'counting')
  if (!landed.length) {
    return p.attempt >= RETRY_FROM_ATTEMPT ? COPY.retrySpoken(p.repo, p.attempt, seconds) : COPY.firstSpoken(p.repo, seconds)
  }
  return COPY.partlySpoken(capital(named(landed)), landed.length > 1, named(by(p, 'counting')))
}

/** The header count: "2 of 4 ready" while warming; once stopped, what each statistic ended as. */
export function stoppedCounts(p: WarmingUpProps): string {
  return (['ready', 'cached', 'missing'] as const)
    .map(state => [by(p, state).length, COPY.stoppedCounts[state]] as const)
    .filter(([n]) => n > 0)
    .map(([n, words]) => `${n} ${words}`)
    .join(' · ')
}

/** The row's meta: the endpoint and what it counts, or the cached copy's date once checking stops. */
export function rowMeta(stat: Stat): string {
  const what =
    stat.state === 'cached' && stat.cachedAt
      ? COPY.copyFrom(dateWords(stat.cachedAt))
      : stat.state === 'missing'
        ? COPY.noCopy
        : STATS[stat.id].counts
  return `stats/${stat.id} · ${what}`
}
