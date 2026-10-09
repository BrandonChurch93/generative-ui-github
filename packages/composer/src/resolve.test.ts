import { describe, expect, it } from 'vitest'
import { createGitHubClient, memoryCache } from '@genui-github/data/server'
import { resolution } from './resolve'
import { noNetwork } from './samples'

const answering = (status: number, data: object, calls: string[] = []) =>
  createGitHubClient({
    token: 'test',
    fetch: async input => {
      calls.push(String(input))
      return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
    },
  })

describe('resolution', () => {
  it('names a sample by its own name, an old name included, with no GitHub call', async () => {
    const gh = noNetwork()
    expect(await resolution('https://github.com/facebook/react', { github: gh.client, cache: memoryCache() })).toEqual({ status: 200, body: { ok: true, repo: 'react/react', sample: true } })
    expect(gh.calls).toEqual([])
  })

  it('resolves a live repo once, as GitHub names it, and keeps the answer', async () => {
    const calls: string[] = []
    const github = answering(200, { full_name: 'Vercel/MS', private: false, default_branch: 'main', owner: { login: 'Vercel' }, name: 'MS' }, calls)
    const cache = memoryCache()
    const deps = { github, cache }
    expect((await resolution('vercel/ms', deps)).body).toEqual({ ok: true, repo: 'Vercel/MS', sample: false })
    await resolution('vercel/ms', deps)
    expect(calls).toHaveLength(1)
  })

  it("says what is wrong: a shape it can't read, a repo that is private or missing", async () => {
    const gh = noNetwork()
    expect(await resolution('not a repo', { github: gh.client, cache: memoryCache() })).toMatchObject({ status: 400, body: { ok: false, kind: 'shape' } })
    expect(await resolution('someone/private', { github: answering(404, { message: 'Not Found' }), cache: memoryCache() })).toEqual({ status: 404, body: { ok: false, kind: 'missing', message: "That repo is private or doesn't exist" } })
  })
})
