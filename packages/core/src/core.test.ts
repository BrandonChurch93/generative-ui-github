import { describe, expect, it } from 'vitest'
import { costUsd, createLogger, loadConfig, MODELS, PRICES, type LogRecord } from './index'

describe('loadConfig', () => {
  it('names every missing required variable', () => {
    const result = loadConfig({ GITHUB_TOKEN: '', ANTHROPIC_API_KEY: undefined })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problems.map(p => p.variable).sort()).toEqual(['ANTHROPIC_API_KEY', 'GITHUB_TOKEN'])
    expect(result.problems.every(p => p.message.endsWith('is not set'))).toBe(true)
  })

  it('defaults the daily cap to 5', () => {
    const result = loadConfig({ GITHUB_TOKEN: 't', ANTHROPIC_API_KEY: 'k' })
    expect(result.ok && result.config.dailyCapUsd).toBe(5)
  })
})

describe('price table', () => {
  it('has a price for every model', () => {
    for (const id of Object.values(MODELS)) expect(PRICES[id]).toBeDefined()
  })

  it('prices a short prompt at the base tier', () => {
    const cost = costUsd(MODELS.haiku, { inputTokens: 60_000, cacheReadTokens: 40_000, outputTokens: 1_000_000 })
    const p = PRICES[MODELS.haiku].base
    expect(cost).toBeCloseTo((60_000 * p.input + 40_000 * p.cacheRead + 1_000_000 * p.output) / 1_000_000)
  })

  it('prices every token at the long tier once the prompt passes the threshold', () => {
    const cost = costUsd(MODELS.haiku, { inputTokens: 60_000, cacheReadTokens: 40_001, outputTokens: 1_000_000 })
    const p = PRICES[MODELS.haiku].longPrompt!.price
    expect(cost).toBeCloseTo((60_000 * p.input + 40_001 * p.cacheRead + 1_000_000 * p.output) / 1_000_000)
  })
})

describe('logger', () => {
  it('drops records below its level', () => {
    const records: LogRecord[] = []
    const log = createLogger('test', { level: 'warn', sink: r => records.push(r) })
    log.info('quiet')
    log.child('child').error('loud')
    expect(records.map(r => [r.scope, r.message])).toEqual([['test:child', 'loud']])
  })
})
