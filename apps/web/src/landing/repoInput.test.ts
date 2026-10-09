import { describe, expect, it } from 'vitest'
import { parseRepoInput, RESOLVE_MESSAGES } from '@genui-github/data/server'
import { parseRepo } from './repoInput'

const WORDS = { required: RESOLVE_MESSAGES.empty, 'repo-shape': RESOLVE_MESSAGES.shape, 'repo-host': RESOLVE_MESSAGES.host } as const

const INPUTS = [
  '',
  '   ',
  'vercel/next.js',
  ' vercel/next.js ',
  'https://github.com/vercel/next.js',
  'http://www.github.com/vercel/next.js/pulls?q=1',
  'github.com/facebook/react.git',
  'github.com/vercel',
  'gitlab.com/foo/bar',
  'vercel',
  'vercel/next js',
  '-bad/name',
  'a--b/c',
  'owner/name#readme',
]

describe('the landing field reads a repo the way the server does', () => {
  it.each(INPUTS)('%j', input => {
    const server = parseRepoInput(input)
    const browser = parseRepo(input)
    if (server.ok) expect(browser).toEqual({ ok: true, owner: server.owner, name: server.name })
    else expect(browser.ok ? undefined : WORDS[browser.problem]).toBe(server.message)
  })
})
