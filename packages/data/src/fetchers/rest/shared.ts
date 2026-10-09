import { isBotLogin } from '../../github/person'
import type { Commit, FileChange, Person } from '../../shapes'
import type { GitHubClient, RestResponse } from '../../github/client'

export interface RestUser {
  login: string
  type?: string
}

export function toPerson(user: RestUser | null | undefined): Person | null {
  if (!user) return null
  return { login: user.login, isBot: isBotLogin(user.login) || user.type === 'Bot' }
}

export interface RestFile {
  filename: string
  status: FileChange['status']
  additions: number
  deletions: number
  patch?: string
  previous_filename?: string
}

/** DiffView stops at 1,000 lines; one line more keeps that stop honest and the rest is never drawn. */
export const PATCH_LINES = 1001

function capPatch(patch: string): string {
  let at = -1
  for (let n = 0; n < PATCH_LINES; n++) {
    at = patch.indexOf('\n', at + 1)
    if (at === -1) return patch
  }
  return patch.slice(0, at)
}

export function toFileChange(file: RestFile): FileChange {
  return {
    path: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    ...(file.patch !== undefined ? { patch: capPatch(file.patch) } : {}),
    ...(file.previous_filename !== undefined ? { previousPath: file.previous_filename } : {}),
  }
}

export interface RestCommit {
  sha: string
  author: RestUser | null
  commit: {
    message: string
    author: { date: string } | null
    committer: { date: string } | null
  }
}

/** The committer date, which is when a squash merge landed and what `since` filters on. */
/** A commit's subject: what a timeline row shows. Bodies run to pages on squash merges. */
const firstLine = (message: string) => (message.split('\n', 1)[0] ?? '').slice(0, 200)

export function toCommit(raw: RestCommit): Commit {
  return {
    sha: raw.sha,
    author: toPerson(raw.author),
    date: raw.commit.committer?.date ?? raw.commit.author?.date ?? '',
    message: firstLine(raw.commit.message),
  }
}

export function hasNextPage(response: RestResponse<unknown>): boolean {
  const link = response.headers.link
  return typeof link === 'string' && /rel="next"/.test(link)
}

/** Zero when either end is missing, as for a job or step still running or never started. */
export function elapsedMs(start: string | null | undefined, end: string | null | undefined): number {
  if (!start || !end) return 0
  return Math.max(0, Date.parse(end) - Date.parse(start))
}

/** Follows the `link` header page by page. `capped` is true when pages remained after `maxPages`. */
export async function fetchPages<Page, Item>(
  client: GitHubClient,
  route: string,
  params: Record<string, unknown>,
  items: (page: Page) => Item[],
  maxPages: number,
): Promise<{ items: Item[]; capped: boolean }> {
  const all: Item[] = []
  for (let page = 1; page <= maxPages; page++) {
    const response = await client.rest<Page>(route, { ...params, page })
    all.push(...items(response.data))
    if (!hasNextPage(response)) return { items: all, capped: false }
  }
  return { items: all, capped: true }
}
