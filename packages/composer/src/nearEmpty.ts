import { readFileSync } from 'node:fs'
import { buildContext, dirFrom, memoryCache, primeSample, type ContextNeeds, type DataContext, type RepoRef, type SampleFile } from '@genui-github/data/server'
import type { Piece } from '@genui-github/renderer/core'
import { bind } from './templates/build'
import { noNetwork } from './samples'

// `?force=empty`: one real, tiny public repo recorded once by `scripts/near-empty-refresh.ts`, so the
// near-empty screen is drawn offline from GitHub's own answers, with no model and no GitHub call.

export const NEAR_EMPTY_REPO: RepoRef = { owner: 'vercel-labs', name: 'vercel-byoc' }
export const NEAR_EMPTY_DIR = dirFrom(import.meta.url, '../fixtures/near-empty/')
export const NEAR_EMPTY_FILE = `${NEAR_EMPTY_DIR}${`${NEAR_EMPTY_REPO.owner}__${NEAR_EMPTY_REPO.name}`.toLowerCase()}.json`

/** At or under this many commits in the window, with no releases and no pull requests, most of a screen is empty. */
export const NEAR_EMPTY_COMMITS = 20

export const nearEmptySentence = (repo: string, commits: number) =>
  `\`${repo}\` has ${commits} ${commits === 1 ? 'commit' : 'commits'} and no releases, so most of this is empty. Here is what there is.`

/** The recorded repo's context for a template's needs, built from the fixture alone. */
export async function nearEmptyContext(needs: ContextNeeds, timeZone = 'UTC'): Promise<{ ctx: DataContext; calls: string[] }> {
  const file = JSON.parse(readFileSync(NEAR_EMPTY_FILE, 'utf8')) as SampleFile
  const cache = memoryCache({ now: () => file.now })
  await primeSample(cache, file)
  const { client, calls } = noNetwork()
  // The insight's sentence counts commits, releases and pull requests, whatever the template reads.
  const shapes = [...new Set([...needs.shapes, 'commits', 'releases', 'pulls'] as const)]
  const ctx = await buildContext(client, cache, NEAR_EMPTY_REPO, { ...needs, shapes }, { now: file.now, timeZone, ttlSeconds: null, offline: true })
  return { ctx, calls }
}

/**
 * The near-empty system sentence (docs/composer.md) in the Insight slot, when the repo has a handful of
 * commits in all, no releases or tags and no pull requests; null otherwise.
 */
export function nearEmptyInsight(ctx: DataContext): Piece | null {
  const commits = ctx.shapes.commits
  const releases = ctx.shapes.releases
  const pulls = ctx.shapes.pulls
  if (!commits || !releases || !pulls) return null
  if (releases.releases.length || releases.tags.length || pulls.open.length || pulls.merged.length) return null
  if (commits.commits.length > NEAR_EMPTY_COMMITS) return null
  // The commits list is windowed; it is the repo's whole history only when the repo is younger than the window.
  const created = ctx.shapes.repo?.createdAt
  if (!created || Date.parse(created) < Date.parse(commits.since)) return null
  return bind(ctx, 'Insight', {
    sentence: nearEmptySentence(`${ctx.repo.owner}/${ctx.repo.name}`, commits.commits.length),
    sources: [{ key: 'commits' }, { key: 'pulls' }, { key: 'releases' }],
    // Quiet, like the reference: an absence is not news, good or bad.
    tone: 'neutral',
  })
}
