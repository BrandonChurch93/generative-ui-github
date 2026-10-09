import type { RepoRef } from '../github/resolve'

/** One interface, two backends (docs/data-layer.md, Cache). */
export interface Cache {
  get<T>(key: string): Promise<{ value: T; cachedAt: string } | null>
  /** `ttlSeconds: null` keeps it forever: the sample repos. */
  set<T>(key: string, value: T, ttlSeconds: number | null): Promise<void>
}

/** Live repos are cached 15 minutes. */
export const LIVE_TTL_SECONDS = 900
/** Sample repos never expire. */
export const SAMPLE_TTL_SECONDS = null

const slug = (repo: RepoRef) => `${repo.owner}/${repo.name}`.toLowerCase()

export const cacheKey = {
  shape: (repo: RepoRef, shape: string) => `repo:${slug(repo)}:${shape}`,
  /** Stats are keyed by the default-branch SHA: a push resets GitHub's numbers, so it resets ours. */
  stats: (repo: RepoRef, sha: string, shape: string) => `stats:${slug(repo)}:${sha}:${shape}`,
}

interface Entry {
  value: unknown
  cachedAt: string
  expiresAt: number | null
}

/** A cache that can also take an entry with the time it was first fetched: how sample repos keep their dates. */
export interface DatedCache extends Cache {
  setAt(key: string, value: unknown, cachedAt: string, ttlSeconds?: number | null): Promise<void>
}

export function memoryCache(options: { now?: () => number } = {}): DatedCache {
  const now = options.now ?? Date.now
  const entries = new Map<string, Entry>()
  return {
    async get<T>(key: string) {
      const entry = entries.get(key)
      if (!entry) return null
      if (entry.expiresAt !== null && entry.expiresAt <= now()) {
        entries.delete(key)
        return null
      }
      return { value: entry.value as T, cachedAt: entry.cachedAt }
    },
    async set(key, value, ttlSeconds) {
      entries.set(key, { value, cachedAt: new Date(now()).toISOString(), expiresAt: ttlSeconds === null ? null : now() + ttlSeconds * 1000 })
    },
    async setAt(key, value, cachedAt, ttlSeconds = null) {
      entries.set(key, { value, cachedAt, expiresAt: ttlSeconds === null ? null : now() + ttlSeconds * 1000 })
    },
  }
}

/** The two calls the KV backend needs; `@upstash/redis` (what Vercel KV runs on) has both. */
export interface KvStore {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown, options?: { ex: number }): Promise<unknown>
}

export function kvCache(store: KvStore, options: { now?: () => number } = {}): DatedCache {
  const now = options.now ?? Date.now
  return {
    async setAt(key, value, cachedAt, ttlSeconds = null) {
      await store.set(key, { value, cachedAt }, ttlSeconds === null ? undefined : { ex: ttlSeconds })
    },
    async get<T>(key: string) {
      const entry = await store.get<{ value: T; cachedAt: string }>(key)
      return entry ?? null
    },
    async set(key, value, ttlSeconds) {
      const entry = { value, cachedAt: new Date(now()).toISOString() }
      await store.set(key, entry, ttlSeconds === null ? undefined : { ex: ttlSeconds })
    },
  }
}

/** Vercel KV when its REST variables are set, else memory (dev, tests, and the fallback). */
export async function createCache(env: Record<string, string | undefined> = process.env): Promise<DatedCache> {
  const url = env.KV_REST_API_URL
  const token = env.KV_REST_API_TOKEN
  if (!url || !token) return memoryCache()
  const { Redis } = await import('@upstash/redis')
  return kvCache(new Redis({ url, token }))
}

/** Reads through the cache: a hit returns the stored copy and when it was stored; a miss loads and stores it. */
export async function cached<T>(cache: Cache, key: string, ttlSeconds: number | null, load: () => Promise<T>): Promise<{ value: T; cachedAt: string; hit: boolean }> {
  const hit = await cache.get<T>(key)
  if (hit) return { ...hit, hit: true }
  const value = await load()
  await cache.set(key, value, ttlSeconds)
  const stored = await cache.get<T>(key)
  return { value, cachedAt: stored?.cachedAt ?? new Date().toISOString(), hit: false }
}
