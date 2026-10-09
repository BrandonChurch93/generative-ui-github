import { describe, expect, it } from 'vitest'
import { toStream, type Composition } from '@genui-github/renderer/core'
import fixture from '@genui-github/renderer/fixtures/1-release-blockers.json' with { type: 'json' }
import { collect, framed, modelText, openUrl } from './frame'

const composition = fixture as unknown as Composition

async function* ops(list: ReturnType<typeof toStream>) {
  for (const op of list) yield op
}

describe('the frame', () => {
  it('keeps the insight, two metrics and the main list, at compact density', () => {
    const f = framed(composition)
    expect(f.density).toBe('compact')
    expect([f.regions.insight.length, f.regions.metrics.length, f.regions.main.length, f.regions.side.length, f.regions.action.length]).toEqual([1, 2, 1, 0, 0])
    expect(f.regions.metrics.map(p => p.id)).toEqual(composition.regions.metrics.slice(0, 2).map(p => p.id))
    expect(f.built).toEqual(composition.built)
  })

  it('links to the full screen for the same question and tells the model the answer in the system words', () => {
    const url = openUrl('https://example.test/', 'vercel/next.js', "What's blocking the next release?")
    expect(url).toBe("https://example.test/r/vercel/next.js?q=What's%20blocking%20the%20next%20release%3F")
    const text = modelText(composition, 'vercel/next.js', url)
    expect(text.split('\n')[0]).toBe((composition.regions.insight[0]!.bound as { sentence: string }).sentence.replace(/`/g, ''))
    expect(text).toContain(url)
  })

  it('reads a stream to its composition, or to the reason it has none', async () => {
    const got = await collect(ops(toStream(composition)))
    expect('composition' in got && got.composition.id).toBe(composition.id)
    expect(await collect(ops([{ op: 'start', id: 'x', density: 'comfortable', asks: [] }, { op: 'error', reason: 'GitHub returned 502' }]))).toEqual({ error: 'GitHub returned 502' })
  })
})
