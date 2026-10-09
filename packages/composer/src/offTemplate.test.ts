import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { dirFrom } from '@genui-github/data/testing'
import { MODELS } from '@genui-github/core'
import { bindLine, replayOffTemplate } from './offTemplate'
import { enforceRules } from './rules'
import { sampleContext } from './samples'
import { offTemplateNeeds } from './templates/needs'
import { checkTree, chose } from './templates/template'
import { nextContext } from './bind/testing'

const SET = dirFrom(import.meta.url, '../../evals/set/')
const RECORDED = dirFrom(import.meta.url, '../fixtures/off-template/')
const cases = readdirSync(SET)
  .filter(f => f.startsWith('off-'))
  .map(f => JSON.parse(readFileSync(SET + f, 'utf8')) as { id: string; repo: string; question: string })

describe('off-template composition, replayed from what Sonnet wrote', () => {
  for (const c of cases) {
    it(`${c.id}: ${c.question}`, async () => {
      const [owner, name] = c.repo.split('/') as [string, string]
      const { ctx, calls } = await sampleContext({ owner, name }, offTemplateNeeds(), { timeZone: 'America/Los_Angeles' })
      const result = replayOffTemplate(ctx, readFileSync(`${RECORDED}${c.id}.jsonl`, 'utf8'))
      const built = { template: 'off-template', reason: 'no template matched' as const, model: MODELS.sonnet, tokens: { input: 0, cached: 0, output: 0 }, costUsd: 0, latencyMs: { classify: 0, data: 0, compose: 0, total: 0 }, githubReads: 0, chose: chose(result.regions) }
      const { composition } = enforceRules({ id: c.id, density: result.density, regions: result.regions, asks: result.asks, built }, { question: c.question })
      expect(checkTree(composition, { question: c.question }).problems).toEqual([])
      expect(calls).toEqual([])
    })
  }

  it('turns a borrowed figure into the system sentence, and a too-long insight into the system insight', async () => {
    const ctx = await nextContext()
    const borrowed = bindLine(ctx, JSON.stringify({ op: 'add', region: 'insight', piece: { component: 'Insight', props: { sentence: 'There are 9,999 open pull requests.', sources: [{ key: 'open-prs' }] } } }))
    expect(borrowed).toMatchObject({ op: 'add', piece: { component: 'Insight' } })
    const sentence = (borrowed as { piece: { props: { sentence: string } } }).piece.props.sentence
    expect(sentence).not.toContain('9,999')
    expect(sentence).toContain('2,524')
    const long = bindLine(ctx, JSON.stringify({ op: 'add', region: 'insight', piece: { component: 'Insight', props: { sentence: 'x'.repeat(200), sources: [{ key: 'open-prs' }] } } }))
    expect((long as { piece: { state?: string } }).piece.state).toBeUndefined()
    const delta = bindLine(ctx, JSON.stringify({ op: 'add', region: 'metrics', piece: { component: 'Metric', props: { measure: 'open-prs', delta: '9,999 last week' } } }))
    expect((delta as { piece: { props: object } }).piece.props).not.toHaveProperty('delta')
  })
})
