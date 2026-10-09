import type { GitHubClient } from '../../github/client'
import type { Scenario } from '../../github/fixtures'
import type { RepoRef } from '../../github/resolve'
import { fetchCodeFrequency } from './codeFrequency'
import { fetchCommitActivity } from './commitActivity'
import { fetchContributorsStat } from './contributors'
import { fetchParticipation } from './participation'
import { fetchPunchCard } from './punchCard'
import { COUNTING } from './request'

export const NEXT: RepoRef = { owner: 'vercel', name: 'next.js' }
/** Under 10,000 commits, so code frequency answers with data where next.js answers 422. */
export const SMALL: RepoRef = { owner: 'vercel', name: 'ms' }

const WAIT_MS = 5000
const TRIES = 12

/** Asks again while GitHub is counting, so the recording ends on real data. Tests pass a sleep that returns at once. */
export async function settle<T>(fetch: () => Promise<T>, sleep: (ms: number) => Promise<void>): Promise<T> {
  let result = await fetch()
  for (let i = 1; i < TRIES && result === COUNTING; i++) {
    await sleep(WAIT_MS)
    result = await fetch()
  }
  return result
}

export function fetchAll(client: GitHubClient, sleep: (ms: number) => Promise<void>) {
  return Promise.all([
    settle(() => fetchCommitActivity(client, NEXT), sleep),
    settle(() => fetchCodeFrequency(client, NEXT), sleep),
    settle(() => fetchCodeFrequency(client, SMALL), sleep),
    settle(() => fetchParticipation(client, NEXT), sleep),
    settle(() => fetchPunchCard(client, NEXT), sleep),
    settle(() => fetchContributorsStat(client, NEXT), sleep),
  ])
}

const KEPT_AUTHORS = 30
const KEPT_WEEKS = 60

interface RawContributor {
  author: { login: string; type?: string } | null
  total: number
  weeks: unknown[]
}

export const scenario: Scenario = {
  name: 'stats-nextjs',
  run: client => fetchAll(client, ms => new Promise(resolve => setTimeout(resolve, ms))),
  trim(key, body) {
    if (!key.endsWith('/stats/contributors') || !Array.isArray(body)) return body
    // The top authors and every bot, each with the last weeks only: enough to show the 52-week cap and the bot flag.
    const authors = body as RawContributor[]
    const top = [...authors].sort((a, b) => b.total - a.total).slice(0, KEPT_AUTHORS)
    const bots = authors.filter(a => !top.includes(a) && (a.author?.login.endsWith('[bot]') || a.author?.type === 'Bot'))
    return authors
      .filter(a => top.includes(a) || bots.includes(a))
      .map(a => ({ author: a.author && { login: a.author.login, type: a.author.type }, total: a.total, weeks: a.weeks.slice(-KEPT_WEEKS) }))
  },
}
