import { MODELS, type ModelId } from './models'

/** USD per million tokens. */
export interface ModelPrice {
  input: number
  cacheWrite5m: number
  cacheWrite1h: number
  cacheRead: number
  output: number
}

// The only place a price lives. Source: https://platform.claude.com/docs/en/about-claude/pricing
export const PRICES_AS_OF = '2026-10-08'

export const PRICES: Record<ModelId, ModelPrice> = {
  [MODELS.haiku]: { input: 1, cacheWrite5m: 1.25, cacheWrite1h: 2, cacheRead: 0.1, output: 5 },
  [MODELS.sonnet]: { input: 2, cacheWrite5m: 2.5, cacheWrite1h: 4, cacheRead: 0.1, output: 10 },
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWrite5mTokens?: number
  cacheWrite1hTokens?: number
}

export function costUsd(model: ModelId, usage: TokenUsage): number {
  const p = PRICES[model]
  const total =
    usage.inputTokens * p.input +
    usage.outputTokens * p.output +
    (usage.cacheReadTokens ?? 0) * p.cacheRead +
    (usage.cacheWrite5mTokens ?? 0) * p.cacheWrite5m +
    (usage.cacheWrite1hTokens ?? 0) * p.cacheWrite1h
  return total / 1_000_000
}
