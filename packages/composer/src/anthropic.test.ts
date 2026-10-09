import { describe, expect, it } from 'vitest'
import { MODELS } from '@genui-github/core'
import { sumUsage, usageOf } from './anthropic'

const usage = (u: Partial<Record<string, unknown>>) =>
  ({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: null, ...u }) as never

describe('cost accounting', () => {
  it('prices a Haiku call with a cache read and a 5-minute write from the price table', () => {
    // 1,200 input at $0.10, 5,703 cache reads at $0.01, 300 written at $0.125, 150 output at $0.50, per million.
    const call = usageOf(MODELS.haiku, usage({ input_tokens: 1200, cache_read_input_tokens: 5703, cache_creation_input_tokens: 300, output_tokens: 150 }), 280)
    expect(call).toMatchObject({ inputTokens: 1200, cachedTokens: 5703, cacheWriteTokens: 300, outputTokens: 150, latencyMs: 280 })
    expect(call.costUsd).toBeCloseTo((1200 * 0.1 + 5703 * 0.01 + 300 * 0.125 + 150 * 0.5) / 1e6, 12)
  })

  it('prices 1-hour writes apart, Sonnet rates, and sums a composition', () => {
    const sonnet = usageOf(MODELS.sonnet, usage({ input_tokens: 3000, cache_creation_input_tokens: 6000, cache_creation: { ephemeral_1h_input_tokens: 6000, ephemeral_5m_input_tokens: 0 }, output_tokens: 1200 }), 4100)
    expect(sonnet.costUsd).toBeCloseTo((3000 * 2 + 6000 * 4 + 1200 * 10) / 1e6, 12)
    const haiku = usageOf(MODELS.haiku, usage({ input_tokens: 500, cache_read_input_tokens: 5703, output_tokens: 40 }), 300)
    expect(sumUsage([haiku, sonnet])).toEqual({ tokens: { input: 9500, cached: 5703, output: 1240 }, costUsd: haiku.costUsd + sonnet.costUsd })
  })

  it('moves a Haiku call over 100,000 prompt tokens to the long-prompt prices', () => {
    const long = usageOf(MODELS.haiku, usage({ input_tokens: 90_000, cache_read_input_tokens: 20_000, output_tokens: 100 }), 900)
    expect(long.costUsd).toBeCloseTo((90_000 * 0.5 + 20_000 * 0.05 + 100 * 2.5) / 1e6, 12)
  })
})
