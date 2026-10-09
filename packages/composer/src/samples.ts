import { buildContext, createGitHubClient, GitHubError, memoryCache, primeSample, readSample, SAMPLE_REPOS, type ContextNeeds, type DataContext } from '@genui-github/data/server'
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
export async function sampleContext(repo: RepoRef, needs: ContextNeeds, options: { timeZone?: string } = {}): Promise<{ ctx: DataContext; calls: string[] }> {
  const sample = readSample(repo)
  const cache = memoryCache({ now: () => sample.now })
  await primeSample(cache, sample)
  const { client, calls } = noNetwork()
  const ctx = await buildContext(client, cache, repo, needs, { now: sample.now, timeZone: options.timeZone ?? 'UTC', ttlSeconds: null })
  return { ctx, calls }
}

export { SAMPLE_REPOS }
