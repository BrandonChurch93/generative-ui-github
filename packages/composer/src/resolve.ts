import { canonicalSample, GitHubError, isSample, LIVE_TTL_SECONDS, parseRepoInput, resolveRepo, type Cache, type GitHubClient } from '@genui-github/data/server'

// GET /api/resolve?repo=: does this repo exist and is it public, before the reader asks it anything. A sample
// answers from its own name with no GitHub call; a live repo is one call, kept as long as its data would be.

export type Resolution = { ok: true; repo: string; sample: boolean } | { ok: false; message: string; kind: 'missing' | 'shape' | 'unreachable' }

const json = (status: number, body: Resolution) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export async function resolution(input: string, deps: { github: GitHubClient; cache: Cache }): Promise<{ status: number; body: Resolution }> {
  const parsed = parseRepoInput(input)
  if (!parsed.ok) return { status: 400, body: { ok: false, message: parsed.message, kind: 'shape' } }
  if (isSample(parsed)) {
    const s = canonicalSample(parsed)
    return { status: 200, body: { ok: true, repo: `${s.owner}/${s.name}`, sample: true } }
  }
  const key = `resolve:${`${parsed.owner}/${parsed.name}`.toLowerCase()}`
  const kept = await deps.cache.get<Resolution>(key).catch(() => null)
  if (kept) return { status: kept.value.ok ? 200 : 404, body: kept.value }
  try {
    const found = await resolveRepo(deps.github, input)
    const body: Resolution = found.ok ? { ok: true, repo: `${found.owner}/${found.name}`, sample: false } : { ok: false, message: found.message, kind: 'missing' }
    await deps.cache.set(key, body, LIVE_TTL_SECONDS).catch(() => undefined)
    return { status: found.ok ? 200 : 404, body }
  } catch (error) {
    const cause = error instanceof GitHubError && error.rateLimited ? "GitHub's rate limit is used up" : `GitHub returned ${error instanceof GitHubError ? error.status : 'no answer'}`
    return { status: 503, body: { ok: false, message: cause, kind: 'unreachable' } }
  }
}

export async function resolveResponse(request: Request, deps: { github: GitHubClient; cache: Cache }): Promise<Response> {
  const repo = new URL(request.url).searchParams.get('repo') ?? ''
  const { status, body } = await resolution(repo.slice(0, 300), deps)
  return json(status, body)
}
