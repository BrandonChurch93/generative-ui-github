import { buildContext, canonicalSample, createGitHubClient, GitHubError, memoryCache, primeSample, readSample, SAMPLE_REPOS, type ContextNeeds, type DataContext, type DatedCache } from '@genui-github/data/server'
import type { RepoRef } from '@genui-github/data/server'

/** A client that refuses every request: a sample repo must answer from its cache alone. */
export function noNetwork(): { client: ReturnType<typeof createGitHubClient>; calls: string[] } {
  const calls: string[] = []
  const client = createGitHubClient({
    token: 'none',
    fetch: async input => {
      calls.push(String(input))
      throw new GitHubError({ status: 0, endpoint: String(input), message: 'Sample repos answer from their cache' })
    },
  })
  return { client, calls }
}

/** A sample repo's context for a template, built from its committed sample with zero GitHub calls. */
export async function sampleContext(asked: RepoRef, needs: ContextNeeds, options: { timeZone?: string } = {}): Promise<{ ctx: DataContext; calls: string[] }> {
  const repo = canonicalSample(asked)
  const sample = readSample(repo)
  const cache = memoryCache({ now: () => sample.now })
  await primeSample(cache, sample)
  const { client, calls } = noNetwork()
  const ctx = await buildContext(client, cache, repo, needs, { now: sample.now, timeZone: options.timeZone ?? 'UTC', ttlSeconds: null, offline: true })
  return { ctx, calls }
}

export { SAMPLE_REPOS }

/** A cache primed with a sample's committed entries, and the instant the sample was built for. */
export async function primeSampleCache(repo: RepoRef, make?: () => DatedCache): Promise<DatedCache & { now: number }> {
  const sample = readSample(repo)
  const cache = make ? make() : memoryCache({ now: () => sample.now })
  await primeSample(cache, sample)
  return Object.assign(cache, { now: sample.now })
}
