import { describe, expect, it, vi } from 'vitest'
import { createGitHubClient, GitHubError } from './client'

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

describe('GitHub client', () => {
  it('turns a rate-limited 403 into a GitHubError carrying status, endpoint, resetAt and retryAfter', async () => {
    const fetch = vi.fn(async () =>
      json(403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1791552000', 'retry-after': '60' }),
    )
    const client = createGitHubClient({ token: 't', fetch })
    const error = await client.rest('GET /repos/{owner}/{repo}', { owner: 'vercel', repo: 'next.js' }).catch(e => e)
    expect(error).toBeInstanceOf(GitHubError)
    expect(error).toMatchObject({ status: 403, endpoint: 'GET /repos/{owner}/{repo}', resetAt: '2026-10-09T13:20:00.000Z', retryAfter: 60 })
    expect(error.rateLimited).toBe(true)
  })

  it('retries a 502 twice, after 1s and 3s, then fails saying so', async () => {
    const fetch = vi.fn(async () => json(502, { message: 'Bad gateway' }))
    const sleep = vi.fn(async () => {})
    const client = createGitHubClient({ token: 't', fetch, sleep })
    const error = await client.rest('GET /repos/{owner}/{repo}/releases', { owner: 'a', repo: 'b' }).catch(e => e)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls).toEqual([[1000], [3000]])
    expect(error).toMatchObject({ status: 502, attempts: 3 })
    expect(error.reason).toBe('GitHub returned 502 · tried twice')
    expect(client.requests).toBe(3)
  })

  it('passes a 202 through as a response, never an error', async () => {
    const client = createGitHubClient({ token: 't', fetch: vi.fn(async () => new Response(null, { status: 202 })) })
    await expect(client.rest('GET /repos/{owner}/{repo}/stats/punch_card', { owner: 'a', repo: 'b' })).resolves.toMatchObject({ status: 202 })
  })
})
