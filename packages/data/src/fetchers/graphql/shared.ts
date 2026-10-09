import { isBotLogin } from '../../github/person'
import { createLogger } from '@genui-github/core'
import type { GitHubClient } from '../../github/client'
import type { ISODate, Person } from '../../shapes'

const log = createLogger('data:graphql')

/** Every query selects this so the point cost of a fetch is visible in the logs. */
export const RATE_LIMIT_FIELD = 'rateLimit { cost remaining }'

interface RateLimit {
  cost: number
  remaining: number
}

export async function query<T>(client: GitHubClient, name: string, text: string, variables: Record<string, unknown>): Promise<T> {
  const data = await client.graphql<T & { rateLimit?: RateLimit }>(text, variables)
  if (data.rateLimit) log.debug('GraphQL cost', { query: name, cost: data.rateLimit.cost, remaining: data.rateLimit.remaining })
  return data
}

export interface ActorNode {
  login: string
  __typename?: string
}

/** GitHub's own name for a deleted account, which GraphQL returns as a null author. */
export const GHOST: Person = { login: 'ghost', isBot: false }

export function toPerson(actor: ActorNode | null | undefined): Person {
  if (!actor) return GHOST
  return { login: actor.login, isBot: actor.__typename === 'Bot' || isBotLogin(actor.login) }
}

/** The earliest moment a human other than the author acted. Bots and the author's own replies do not count. */
export function firstHumanAt(events: { author: Person; at: ISODate | null }[], author: Person): ISODate | null {
  let first: ISODate | null = null
  for (const { author: actor, at } of events) {
    if (!at || actor.isBot || actor.login.toLowerCase() === author.login.toLowerCase()) continue
    if (first === null || Date.parse(at) < Date.parse(first)) first = at
  }
  return first
}

export const names = (connection: { nodes: ({ name: string } | null)[] | null } | null | undefined): string[] =>
  (connection?.nodes ?? []).flatMap(node => (node ? [node.name] : []))

const time = (date: ISODate | null) => (date ? Date.parse(date) : 0)

/** Newest first; a missing date sorts last. */
export const newestFirst = <T>(pick: (item: T) => ISODate | null) => (a: T, b: T) => time(pick(b)) - time(pick(a))
