import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { z } from 'zod'
import { costUsd, createLogger, type ModelId } from '@genui-github/core'

// The one place the composer calls a model. The registry block is cached; every call is costed from the
// price table in packages/core, the only place a price lives.

const log = createLogger('composer:anthropic')

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/** What one call used and cost. `cachedTokens` are cache reads; writes are priced apart and counted as input. */
export interface CallUsage {
  model: ModelId
  inputTokens: number
  cachedTokens: number
  cacheWriteTokens: number
  outputTokens: number
  costUsd: number
  latencyMs: number
}

/** Anthropic's usage block to our accounting. 1-hour writes are priced as such; the rest are 5-minute writes. */
export function usageOf(model: ModelId, usage: Anthropic.Usage, latencyMs: number): CallUsage {
  const read = usage.cache_read_input_tokens ?? 0
  const written = usage.cache_creation_input_tokens ?? 0
  const hour = usage.cache_creation?.ephemeral_1h_input_tokens ?? 0
  return {
    model,
    inputTokens: usage.input_tokens,
    cachedTokens: read,
    cacheWriteTokens: written,
    outputTokens: usage.output_tokens,
    costUsd: costUsd(model, {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: read,
      cacheWrite1hTokens: hour,
      cacheWrite5mTokens: Math.max(0, written - hour),
    }),
    latencyMs,
  }
}

/** Sums the calls of one composition into the `built` figures. */
export function sumUsage(calls: readonly CallUsage[]): { tokens: { input: number; cached: number; output: number }; costUsd: number } {
  return calls.reduce(
    (sum, c) => ({
      tokens: { input: sum.tokens.input + c.inputTokens + c.cacheWriteTokens, cached: sum.tokens.cached + c.cachedTokens, output: sum.tokens.output + c.outputTokens },
      costUsd: sum.costUsd + c.costUsd,
    }),
    { tokens: { input: 0, cached: 0, output: 0 }, costUsd: 0 },
  )
}

export interface CallOptions {
  model: ModelId
  /** Stable text first: it is cached as one block, so the same bytes every call. */
  cachedSystem: string
  /** Per-call instructions after the cached block. */
  system?: string
  user: string
  maxTokens: number
  effort: Effort
  signal?: AbortSignal
}

/** The narrow surface the composer needs, so tests can stand in for the SDK. */
export interface ModelClient {
  json<S extends z.ZodType>(options: CallOptions & { schema: S }): Promise<{ value: z.infer<S> | null; usage: CallUsage; stopReason: string | null }>
  /** Text as it streams, then the usage. Off-template composition writes JSONL through this. */
  stream(options: CallOptions): { text: AsyncIterable<string>; done: Promise<{ usage: CallUsage; stopReason: string | null }> }
}

function systemBlocks(options: CallOptions): Anthropic.TextBlockParam[] {
  return [
    { type: 'text', text: options.cachedSystem, cache_control: { type: 'ephemeral' } },
    ...(options.system ? [{ type: 'text' as const, text: options.system }] : []),
  ]
}

export function createModelClient(client: Anthropic = new Anthropic()): ModelClient {
  return {
    async json(options) {
      const started = Date.now()
      const response = await client.messages.parse(
        {
          model: options.model,
          max_tokens: options.maxTokens,
          system: systemBlocks(options),
          messages: [{ role: 'user', content: options.user }],
          output_config: { effort: options.effort, format: zodOutputFormat(options.schema) },
        },
        { signal: options.signal },
      )
      const usage = usageOf(options.model, response.usage, Date.now() - started)
      if (response.stop_reason === 'refusal' || response.parsed_output === null) {
        log.warn('model returned no usable JSON', { model: options.model, stopReason: response.stop_reason })
      }
      return { value: response.parsed_output ?? null, usage, stopReason: response.stop_reason }
    },
    stream(options) {
      const started = Date.now()
      const stream = client.messages.stream(
        {
          model: options.model,
          max_tokens: options.maxTokens,
          system: systemBlocks(options),
          messages: [{ role: 'user', content: options.user }],
          output_config: { effort: options.effort },
        },
        { signal: options.signal },
      )
      async function* text() {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') yield event.delta.text
        }
      }
      const done = stream.finalMessage().then(m => ({ usage: usageOf(options.model, m.usage, Date.now() - started), stopReason: m.stop_reason }))
      return { text: text(), done }
    },
  }
}
