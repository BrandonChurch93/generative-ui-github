import { describe, expect, it } from 'vitest'
import { buildContext, memoryCache } from '@genui-github/data/server'
import { CONTEXT_NOW, CONTEXT_ZONE, fixtureClient, NEXT } from '@genui-github/data/testing'
import { needsFor, TEMPLATE_NEEDS } from './needs'

describe('data context for a template', () => {
  it('keeps the release-blockers context for next.js under 3,000 tokens', async () => {
    const { client, misses } = fixtureClient('context-nextjs')
    const ctx = await buildContext(client, memoryCache({ now: () => CONTEXT_NOW }), NEXT, needsFor('release-blockers'), { now: CONTEXT_NOW, timeZone: CONTEXT_ZONE })
    expect(misses).toEqual([])
    expect(ctx.tokens).toBeLessThan(3000)
    expect(Object.keys(ctx.measures).sort()).toEqual([...TEMPLATE_NEEDS['release-blockers'].measures].sort())
    expect(Object.keys(ctx.view)).toEqual(expect.arrayContaining(['measures', 'blockingPrs', 'checks', 'ciDurationByWeek']))
  })
})
