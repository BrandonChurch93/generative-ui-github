import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MODELS } from '@genui-github/core'
import { dirFrom, memoryCache } from '@genui-github/data/server'
import { builtSchema, type StreamOp } from '@genui-github/renderer/core'
import type { CallUsage, ModelClient } from './anthropic'
import type { Classification } from './classify'
import { composeResponse } from './http'
import { dayOf, memoryLimits, VISITOR_LIMIT, type Limits } from './limits'
import { noNetwork } from './samples'
import type { TemplateId } from './templates/needs'

const usage: CallUsage = { model: MODELS.haiku, inputTokens: 900, cachedTokens: 600, cacheWriteTokens: 0, outputTokens: 40, costUsd: 0.0001, latencyMs: 5 }
const NONE: Classification['params'] = { pr: null, handle: null, branch: null, window: null, day: null, weekday: null, hour: null }

/** A model that routes every question to `route` and writes no prose; it counts every call. */
function models(route: TemplateId | 'off-template', streamed = '') {
  const calls: string[] = []
  const client: ModelClient = {
    async json(options) {
      calls.push(options.model)
      const classifying = options.user.startsWith('Question:') && options.user.includes('\nRepo: ') && !options.user.includes('Sentences to rewrite')
      const value = classifying ? { template: route, confidence: 0.9, params: NONE } : { slots: [] }
      // The stand-in answers for the classifier's schema or the fill's, the only two the composer passes.
      return { value: value as never, usage, stopReason: 'end_turn' }
    },
    stream(options) {
      calls.push(options.model)
      return {
        text: (async function* () {
          yield streamed
        })(),
        done: Promise.resolve({ usage: { ...usage, model: MODELS.sonnet }, stopReason: 'end_turn' }),
      }
    },
  }
  return { client, calls }
}

function setup(route: TemplateId | 'off-template', limits: Limits = memoryLimits(), streamed?: string, cache?: ReturnType<typeof memoryCache>) {
  const m = models(route, streamed)
  const gh = noNetwork()
  const deps = () => ({ models: m.client, github: gh.client, cache: cache ?? memoryCache(), limits, dailyCapUsd: 5 })
  const post = (body: object) =>
    composeResponse(new Request('http://x/api/compose', { method: 'POST', body: JSON.stringify(body), headers: { 'user-agent': 'test', 'x-forwarded-for': '203.0.113.7' } }), deps)
  return { post, modelCalls: m.calls, githubCalls: gh.calls }
}

const ops = async (response: Response) => (await response.text()).trim().split('\n').map(l => JSON.parse(l) as StreamOp)

describe('POST /api/compose', () => {
  it('serves a golden question on a sample repo from its committed composition: zero model calls, zero GitHub calls', async () => {
    const { post, modelCalls, githubCalls } = setup('release-blockers')
    const response = await post({ repo: 'vercel/next.js', question: "What's blocking the next release?" })
    expect(response.status).toBe(200)
    const stream = await ops(response)
    expect(stream[0]!.op).toBe('start')
    expect(stream.filter(o => o.op === 'add').length).toBeGreaterThan(4)
    expect([modelCalls, githubCalls]).toEqual([[], []])
    const done = stream.at(-1) as Extract<StreamOp, { op: 'done' }>
    expect(builtSchema.safeParse(done.built).success).toBe(true)
    expect(done.built.template).toBe('release-blockers')
  })

  it('answers the old name of a sample repo from the same golden composition', async () => {
    const { post, modelCalls } = setup('contributors')
    expect((await post({ repo: 'https://github.com/facebook/react', question: "Who's carrying this repo?" })).status).toBe(200)
    expect(modelCalls).toEqual([])
  })

  it(`gives the rate-limit response once a visitor has asked ${VISITOR_LIMIT} live questions today`, async () => {
    const { post, githubCalls } = setup('ci-trend')
    for (let i = 0; i < VISITOR_LIMIT; i++) expect((await post({ repo: 'vercel/next.js', question: 'are builds taking longer than they used to' })).status).toBe(200)
    const refused = await post({ repo: 'vercel/next.js', question: 'are builds taking longer than they used to' })
    expect(refused.status).toBe(429)
    expect(await refused.json()).toMatchObject({ error: 'visitor-limit', message: "That's today's 15 live questions. Sample repos and cached answers still work." })
    expect((await post({ repo: 'vercel/next.js', question: 'Is CI getting slower?' })).status).toBe(200)
    expect(githubCalls).toEqual([])
  })

  it('pauses live questions at the daily cap and says so, while golden answers still work', async () => {
    const limits = memoryLimits()
    await limits.addSpend(dayOf(Date.now()), 5)
    const { post } = setup('ci-trend', limits)
    const refused = await post({ repo: 'vercel/next.js', question: 'are builds taking longer' })
    expect(refused.status).toBe(429)
    expect(await refused.json()).toMatchObject({ error: 'daily-cap', message: 'Live questions are paused for today. Sample repos and cached answers still work.' })
    expect((await post({ repo: 'vercel/next.js', question: 'Is CI getting slower?' })).status).toBe(200)
  })

  it('carries every Built field on a live template composition and on an off-template one', async () => {
    const live = setup('ci-trend')
    const templated = (await ops(await live.post({ repo: 'vitejs/vite', question: 'are builds taking longer' }))).at(-1) as Extract<StreamOp, { op: 'done' }>
    expect(builtSchema.strict().parse(templated.built)).toMatchObject({ template: 'ci-trend', model: MODELS.haiku, githubReads: 0 })
    expect(Object.keys(templated.built).sort()).toEqual(['chose', 'costUsd', 'githubReads', 'latencyMs', 'model', 'template', 'tokens'])
    expect(live.modelCalls).toEqual([MODELS.haiku, MODELS.haiku])

    const recorded = readFileSync(`${dirFrom(import.meta.url, '../fixtures/off-template/')}off-03.jsonl`, 'utf8')
    const off = setup('off-template', memoryLimits(), recorded)
    const stream = await ops(await off.post({ repo: 'vercel/next.js', question: 'how long do docs PRs wait compared to code PRs' }))
    const done = stream.at(-1) as Extract<StreamOp, { op: 'done' }>
    expect(done.built).toMatchObject({ template: 'off-template', reason: 'no template matched', model: MODELS.sonnet })
    expect(stream.filter(o => o.op === 'add').map(o => (o as Extract<StreamOp, { op: 'add' }>).region)[0]).toBe('insight')
  })

  it('replays a composed answer from the cache for a share URL: no model call, no visitor count, even at the cap', async () => {
    const limits = memoryLimits()
    const { post, modelCalls } = setup('ci-trend', limits, undefined, memoryCache())
    const first = await ops(await post({ repo: 'vercel/next.js', question: 'are builds taking longer' }))
    expect(modelCalls.length).toBe(2)
    await limits.addSpend(dayOf(Date.now()), 5)
    const again = await post({ repo: 'Vercel/Next.js', question: 'Are builds  taking longer' })
    expect(again.status).toBe(200)
    const second = await ops(again)
    expect(modelCalls.length).toBe(2)
    expect(second.filter(o => o.op === 'add')).toEqual(first.filter(o => o.op === 'add'))
  })

  it('refuses a repo it cannot read with the system words, before anything streams', async () => {
    const { post } = setup('overview')
    const response = await post({ repo: 'https://gitlab.com/x/y', question: "How's this repo doing?" })
    expect([response.status, (await response.json()).message]).toEqual([400, 'Only github.com repos'])
  })
})
