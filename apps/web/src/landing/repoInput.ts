// The browser's copy of `parseRepoInput` (packages/data/src/github/resolve.ts). That module imports the GitHub
// client, so it cannot ship to the browser; repoInput.test.ts holds the two to the same answers.

export type RepoInput = { ok: true; owner: string; name: string } | { ok: false; problem: 'required' | 'repo-shape' | 'repo-host' }

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/
const NAME = /^[A-Za-z0-9._-]{1,100}$/

/** What the reader typed, to owner and name, without calling GitHub. */
export function parseRepo(input: string): RepoInput {
  let text = input.trim()
  if (!text) return { ok: false, problem: 'required' }
  text = text.replace(/^[a-z]+:\/\//i, '').replace(/[?#].*$/, '')
  let segments = text.split('/').filter(Boolean)
  // An owner never holds a dot, so a dotted first segment is a host.
  if (segments[0]?.includes('.')) {
    const host = segments[0].toLowerCase().replace(/^www\./, '')
    if (host !== 'github.com') return { ok: false, problem: 'repo-host' }
    segments = segments.slice(1)
  }
  const [owner, rawName] = segments
  if (!owner || !rawName) return { ok: false, problem: 'repo-shape' }
  const name = rawName.replace(/\.git$/i, '')
  if (!OWNER.test(owner) || !NAME.test(name)) return { ok: false, problem: 'repo-shape' }
  return { ok: true, owner, name }
}

/** The composed screen's address for a repo, and a question when one is asked. */
export function repoPath(repo: string, question?: string): string {
  const [owner = '', name = ''] = repo.split('/')
  const path = `/r/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
  return question ? `${path}?q=${encodeURIComponent(question)}` : path
}
