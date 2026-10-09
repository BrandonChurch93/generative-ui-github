import type { Scenario } from './fixtures'
import { resolveRepo } from './resolve'

/** The ten inputs from docs/data-layer.md. */
export const RESOLVE_CASES: [input: string, expected: string][] = [
  ['vercel/next.js', 'vercel/next.js'],
  ['https://github.com/vercel/next.js', 'vercel/next.js'],
  ['https://github.com/vercel/next.js/pulls', 'vercel/next.js'],
  ['github.com/vercel/next.js.git', 'vercel/next.js'],
  ['  Vercel/Next.js  ', 'vercel/next.js'],
  ['vercel', 'Needs owner/name, like vercel/next.js'],
  ['vercel/next.js/extra/deep', 'vercel/next.js'],
  ['genui-github-fixtures/this-repo-does-not-exist', "That repo is private or doesn't exist"],
  ['https://gitlab.com/x/y', 'Only github.com repos'],
  ['', 'Paste a public GitHub repo'],
]

export const scenario: Scenario = {
  name: 'resolve',
  async run(client) {
    for (const [input] of RESOLVE_CASES) await resolveRepo(client, input)
  },
  trim: (_key, body) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return body
    const { full_name, private: isPrivate, default_branch, owner, name, message } = body as Record<string, unknown>
    return { full_name, private: isPrivate, default_branch, owner: owner && { login: (owner as { login: string }).login }, name, message }
  },
}
