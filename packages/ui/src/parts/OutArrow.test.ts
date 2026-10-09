import { describe, expect, it } from 'vitest'
import { githubDestination } from './OutArrow'

describe('githubDestination', () => {
  it('names each GitHub destination from its URL, and an unknown one plainly', () => {
    const cases: [string, string | undefined, string][] = [
      ['https://github.com/vercel/next.js/pull/84039', undefined, 'Open PR #84039 on GitHub'],
      ['https://github.com/vercel/next.js/pull/84039/files', undefined, 'Open PR #84039 on GitHub'],
      ['https://github.com/vercel/next.js/issues/84201', undefined, 'Open issue #84201 on GitHub'],
      ['https://github.com/vercel/next.js/actions/runs/1234', 'build-and-test', 'Open run build-and-test on GitHub'],
      ['https://github.com/vercel/next.js/commit/0123456789abcdef', undefined, 'Open commit 0123456 on GitHub'],
      ['https://github.com/tkato', undefined, 'Open tkato on GitHub'],
      ['https://github.com/vercel/next.js/blob/canary/readme.md', undefined, 'Open file readme.md on GitHub'],
      ['https://github.com/vercel/next.js/community', undefined, 'Open on GitHub'],
      ['not a url', undefined, 'Open on GitHub'],
    ]
    for (const [href, name, words] of cases) expect(githubDestination(href, name), href).toBe(words)
  })
})
