import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MODELS } from '@genui-github/core'
import type { CallUsage, ModelClient } from './anthropic'
import { routingCases } from './cases'
import { classify, MIN_CONFIDENCE, type Classification } from './classify'
import { NEXT_SUMMARY } from './fixtures'

const recorded = JSON.parse(readFileSync(new URL('../fixtures/classify.json', import.meta.url), 'utf8')) as {
  responses: { question: string; result: Classification; usage: CallUsage }[]
}

const usage: CallUsage = { model: MODELS.haiku, inputTokens: 0, cachedTokens: 0, cacheWriteTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0 }

/** Answers each question with what the live model answered when the fixture was recorded. */
function replay(answer?: (question: string) => Classification): ModelClient {
  return {
    async json(options) {
      const question = options.user.split('\n')[0]!.replace(/^Question: /, '')
      const value = answer ? answer(question) : recorded.responses.find(r => r.question === question)?.result
      if (!value) throw new Error(`no recorded classification for ${question}`)
      return { value, usage, stopReason: 'end_turn' }
    },
    stream: () => {
      throw new Error('the classifier never streams')
    },
  }
}

describe('classifier', () => {
  it('routes the 12 golden questions and the 20 paraphrases right, on the recorded responses', async () => {
    const cases = routingCases()
    expect(cases).toHaveLength(32)
    const client = replay()
    for (const c of cases) {
      const { result } = await classify(client, { question: c.question, summary: NEXT_SUMMARY })
      expect(result.template, c.id).toBe(c.template)
    }
  })

  it('sends a template it is unsure of to off-template', async () => {
    const unsure: Classification = { template: 'overview', confidence: MIN_CONFIDENCE - 0.01, params: { pr: null, handle: null, branch: null, window: null, day: null, weekday: null, hour: null } }
    const { result } = await classify(replay(() => unsure), { question: 'what is the vibe', summary: NEXT_SUMMARY })
    expect(result.template).toBe('off-template')
  })
})
