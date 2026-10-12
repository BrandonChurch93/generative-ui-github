import { describe, expect, it } from 'vitest'
import { noNetwork, type CallUsage, type ModelClient } from '@genui-github/composer'
import { MODELS } from '@genui-github/core'
import { memoryCache } from '@genui-github/data/server'
import { aggregate, resultsFile, runCase } from './run'
import { loadSet } from './set'

const usage: CallUsage = { model: MODELS.haiku, inputTokens: 900, cachedTokens: 600, cacheWriteTokens: 0, outputTokens: 40, costUsd: 0.0001, latencyMs: 5 }
const NONE = { pr: null, handle: null, branch: null, window: null, day: null, weekday: null, hour: null }

/** A model that routes to `template` and leaves every prose slot to the system. */
function model(template: string): { client: ModelClient; calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    client: {
      async json(options) {
        calls.push(options.model)
        const classifying = !options.user.includes('Sentences to rewrite')
        return { value: (classifying ? { template, confidence: 0.9, params: NONE } : { slots: [] }) as never, usage, stopReason: 'end_turn' }
      },
      stream() {
        throw new Error('no off-template here')
      },
    },
  }
}

describe('the runner', () => {
  const set = loadSet()

  it('composes a golden case fresh, past the committed answer, and scores every scorer that applies', async () => {
    const c = set.find(x => x.id === 'golden-04-nextjs')!
    const m = model(c.expect.template)
    const gh = noNetwork()
    const r = await runCase(c, 'production', { models: m.client, github: gh.client, cache: memoryCache() })
    expect(m.calls.length).toBe(2)
    expect(gh.calls).toEqual([])
    expect(r.outcome).toBe('composed')
    expect(r.routed).toBe('ci-trend')
    expect(r.scores.template).toEqual({ pass: true })
    for (const s of ['components', 'schema', 'bindings', 'numbers', 'rules'] as const) expect(r.scores[s], s).not.toBeNull()
    expect(r.scores.hot).toBeNull()
    expect(r.scores.schema?.pass).toBe(true)
    expect(r.scores.bindings?.pass).toBe(true)
    expect(r.costUsd).toBeCloseTo(0.0002)
    expect(r.latency.firstPieceMs).not.toBeNull()

    const wrong = await runCase(c, 'production', { models: model('overview').client, github: gh.client, cache: memoryCache() })
    expect(wrong.scores.template).toEqual({ pass: false, reason: 'routed to overview, expected ci-trend' })
    expect(aggregate([r, { ...wrong, run: 2 }]).pass.template).toEqual({ mean: 0.5, min: 0, max: 1, n: 1 })

    // A composition that errors is a failure on every scorer it expected, never an unscored case.
    const broken: ModelClient = { ...m.client, json: async () => { throw new Error('the model is down') } }
    const failed = await runCase(c, 'production', { models: broken, github: gh.client, cache: memoryCache() })
    expect(failed.outcome).toBe('failed')
    expect([failed.scores.template?.pass, failed.scores.components?.pass, failed.scores.bindings?.pass]).toEqual([false, false, false])
  })

  it('leaves template and bindings unscored on the sonnet run, which skips routing, and says why in the file', async () => {
    const c = set.find(x => x.id === 'golden-04-nextjs')!
    const r = await runCase(c, 'sonnet', { models: model(c.expect.template).client, github: noNetwork().client, cache: memoryCache() })
    expect(r.outcome).toBe('failed')
    expect([r.scores.template, r.scores.bindings]).toEqual([null, null])
    expect(r.scores.components?.pass).toBe(false)
    const file = resultsFile('sonnet', [r])
    expect(file.notScored).toEqual({ template: 'no routing', bindings: 'no routing' })
    expect([file.aggregate.pass.template, file.aggregate.pass.bindings]).toEqual([null, null])
  })
})
