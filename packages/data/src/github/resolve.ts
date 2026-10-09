import { GitHubError, type GitHubClient } from './client'

/** The system's words for a repo that cannot be read, shown in the field's validation line. */
export const RESOLVE_MESSAGES = {
  empty: 'Paste a public GitHub repo',
  shape: 'Needs owner/name, like vercel/next.js',
  host: 'Only github.com repos',
  missing: "That repo is private or doesn't exist",
} as const

export interface RepoRef {
  owner: string
  name: string
}

export type ParsedRepo = ({ ok: true } & RepoRef) | { ok: false; message: string }

export type ResolvedRepo =
  | { ok: true; owner: string; name: string; fullName: string; defaultBranch: string }
  | { ok: false; message: string }

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/
const NAME = /^[A-Za-z0-9._-]{1,100}$/

/** What the reader typed, to owner and name, without calling GitHub. */
export function parseRepoInput(input: string): ParsedRepo {
  let text = input.trim()
  if (!text) return { ok: false, message: RESOLVE_MESSAGES.empty }
  text = text.replace(/^[a-z]+:\/\//i, '').replace(/[?#].*$/, '')
  let segments = text.split('/').filter(Boolean)
  // An owner never holds a dot, so a dotted first segment is a host.
  if (segments[0]?.includes('.')) {
    const host = segments[0].toLowerCase().replace(/^www\./, '')
    if (host !== 'github.com') return { ok: false, message: RESOLVE_MESSAGES.host }
    segments = segments.slice(1)
  }
  const [owner, rawName] = segments
  if (!owner || !rawName) return { ok: false, message: RESOLVE_MESSAGES.shape }
  const name = rawName.replace(/\.git$/i, '')
  if (!OWNER.test(owner) || !NAME.test(name)) return { ok: false, message: RESOLVE_MESSAGES.shape }
  return { ok: true, owner, name }
}

interface RepoResponse {
  full_name: string
  private: boolean
  default_branch: string
  owner: { login: string }
  name: string
}

/** Parses, then asks GitHub, which also gives the canonical casing. Public repos only. */
export async function resolveRepo(client: GitHubClient, input: string): Promise<ResolvedRepo> {
  const parsed = parseRepoInput(input)
  if (!parsed.ok) return parsed
  try {
    const { data } = await client.rest<RepoResponse>('GET /repos/{owner}/{repo}', { owner: parsed.owner, repo: parsed.name })
    if (data.private) return { ok: false, message: RESOLVE_MESSAGES.missing }
    return { ok: true, owner: data.owner.login, name: data.name, fullName: data.full_name, defaultBranch: data.default_branch }
  } catch (error) {
    if (error instanceof GitHubError && (error.status === 404 || error.status === 451)) return { ok: false, message: RESOLVE_MESSAGES.missing }
    throw error
  }
}
