import { MODELS, type ModelId } from './models'

/** USD per million tokens. */
export interface ModelPrice {
  input: number
  cacheWrite5m: number
  cacheWrite1h: number
  cacheRead: number
  output: number
}

export interface ModelPricing {
  base: ModelPrice
  /** A request whose whole prompt (input, cache reads and writes) is over `overTokens` pays these prices for everything. */
  longPrompt?: { overTokens: number; price: ModelPrice }
}

// The only place a price lives. Source: https://platform.claude.com/docs/en/about-claude/pricing
export const PRICES_AS_OF = '2026-10-08'

export const PRICES: Record<ModelId, ModelPricing> = {
  [MODELS.haiku]: {
    base: { input: 0.1, cacheWrite5m: 0.125, cacheWrite1h: 0.2, cacheRead: 0.01, output: 0.5 },
    longPrompt: { overTokens: 100_000, price: { input: 0.5, cacheWrite5m: 0.625, cacheWrite1h: 1, cacheRead: 0.05, output: 2.5 } },
  },
  [MODELS.sonnet]: {
    base: { input: 2, cacheWrite5m: 2.5, cacheWrite1h: 4, cacheRead: 0.1, output: 10 },
  },
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWrite5mTokens?: number
  cacheWrite1hTokens?: number
}

export function priceFor(model: ModelId, usage: TokenUsage): ModelPrice {
  const { base, longPrompt } = PRICES[model]
  const prompt =
    usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWrite5mTokens ?? 0) + (usage.cacheWrite1hTokens ?? 0)
  return longPrompt && prompt > longPrompt.overTokens ? longPrompt.price : base
}

export function costUsd(model: ModelId, usage: TokenUsage): number {
  const p = priceFor(model, usage)
  const total =
    usage.inputTokens * p.input +
    usage.outputTokens * p.output +
    (usage.cacheReadTokens ?? 0) * p.cacheRead +
    (usage.cacheWrite5mTokens ?? 0) * p.cacheWrite5m +
    (usage.cacheWrite1hTokens ?? 0) * p.cacheWrite1h
  return total / 1_000_000
}
