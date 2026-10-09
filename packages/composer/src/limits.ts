import { createHash } from 'node:crypto'
import type { KvStore } from '@genui-github/data/server'

// The two counters docs/decisions.md asks for: live questions per visitor per day, and spend per day against
// the cap. Both are day-scoped (UTC) and gone at midnight. Nothing else about a visitor is kept.

/** Live composer calls per visitor per day. */
export const VISITOR_LIMIT = 15

export interface Limits {
  /** Live questions this visitor has asked today. */
  visitorCount(visitor: string, day: string): Promise<number>
  /** Counts one more, returning the new total. */
  countVisitor(visitor: string, day: string): Promise<number>
  /** USD spent on model calls today, across everyone. */
  spend(day: string): Promise<number>
  addSpend(day: string, usd: number): Promise<void>
}

/** The UTC day, `YYYY-MM-DD`: every counter's scope. */
export const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10)

/** Midnight UTC after `now`, when the counters reset. */
export const resetAt = (now: number) => new Date(Date.parse(`${dayOf(now)}T00:00:00Z`) + 86_400_000).toISOString()

/** A SHA-256 of IP and user agent: the counter's key, never stored with anything else. */
export function visitorKey(ip: string, userAgent: string): string {
  return createHash('sha256').update(`${ip}\n${userAgent}`).digest('hex')
}

/** In-memory counters, for dev and tests only: serverless instances do not share memory. */
export function memoryLimits(): Limits {
  const visitors = new Map<string, number>()
  const spend = new Map<string, number>()
  return {
    visitorCount: async (v, day) => visitors.get(`${day}:${v}`) ?? 0,
    async countVisitor(v, day) {
      const n = (visitors.get(`${day}:${v}`) ?? 0) + 1
      visitors.set(`${day}:${v}`, n)
      return n
    },
    spend: async day => spend.get(day) ?? 0,
    async addSpend(day, usd) {
      spend.set(day, (spend.get(day) ?? 0) + usd)
    },
  }
}

/** The counters on Vercel KV (Upstash Redis), which survive cold starts. Keys expire two days after their day. */
export function kvLimits(store: KvStore & { incr(key: string): Promise<number>; incrbyfloat(key: string, by: number): Promise<number | string>; expire(key: string, seconds: number): Promise<unknown> }): Limits {
  const ttl = 2 * 86_400
  return {
    visitorCount: async (v, day) => Number((await store.get<number>(`limit:${day}:${v}`)) ?? 0),
    async countVisitor(v, day) {
      const key = `limit:${day}:${v}`
      const n = await store.incr(key)
      if (n === 1) await store.expire(key, ttl)
      return n
    },
    spend: async day => Number((await store.get<number | string>(`spend:${day}`)) ?? 0),
    async addSpend(day, usd) {
      await store.incrbyfloat(`spend:${day}`, usd)
      await store.expire(`spend:${day}`, ttl)
    },
  }
}
