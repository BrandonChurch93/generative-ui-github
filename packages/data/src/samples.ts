import { readFileSync } from 'node:fs'
import { dirFrom } from './paths'
import type { DatedCache } from './cache/cache'
import type { RepoRef } from './github/resolve'

/** The five sample repos (docs/decisions.md). Precomputed by `pnpm samples:refresh`, cached forever. */
export const SAMPLE_REPOS: readonly RepoRef[] = [
  { owner: 'vercel', name: 'next.js' },
  // facebook/react moved to react/react; GitHub redirects the old name, and the resolver returns the new one.
  { owner: 'react', name: 'react' },
  { owner: 'anthropics', name: 'claude-code' },
  { owner: 'tailwindlabs', name: 'tailwindcss' },
  { owner: 'vitejs', name: 'vite' },
]

export const SAMPLE_DIR = dirFrom(import.meta.url, '../samples/')

export interface SampleFile {
  repo: string
  sha: string
  /** The instant the context was built for: windows and cache keys are read against it, so a sample stays as it was. */
  now: number
  refreshedAt: string
  /** What the refresh cost. */
  githubRequests: number
  /** Every cache entry the context build wrote, by key. */
  entries: Record<string, { value: unknown; cachedAt: string }>
}

export const sampleFileName = (repo: RepoRef) => `${repo.owner}__${repo.name}.json`.toLowerCase()

/** Old names GitHub still redirects, so a pasted link to them finds the sample. */
export const SAMPLE_ALIASES: Readonly<Record<string, string>> = { 'facebook/react': 'react/react' }

export function isSample(repo: RepoRef): boolean {
  const name = `${repo.owner}/${repo.name}`.toLowerCase()
  const canonical = SAMPLE_ALIASES[name] ?? name
  return SAMPLE_REPOS.some(s => `${s.owner}/${s.name}`.toLowerCase() === canonical)
}

/** The sample's own name for a repo, following an old name GitHub redirects. */
export function canonicalSample(repo: RepoRef): RepoRef {
  const alias = SAMPLE_ALIASES[`${repo.owner}/${repo.name}`.toLowerCase()]
  if (!alias) return repo
  const [owner, name] = alias.split('/') as [string, string]
  return { owner, name }
}

export function readSample(repo: RepoRef): SampleFile {
  return JSON.parse(readFileSync(`${SAMPLE_DIR}${sampleFileName(canonicalSample(repo))}`, 'utf8')) as SampleFile
}

/** Loads a sample's entries into the cache with no expiry, keeping the time each was fetched. */
export async function primeSample(cache: DatedCache, sample: SampleFile): Promise<number> {
  const entries = Object.entries(sample.entries)
  await Promise.all(entries.map(([key, entry]) => cache.setAt(key, entry.value, entry.cachedAt, null)))
  return entries.length
}
