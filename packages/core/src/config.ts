import { z } from 'zod'

const required = (name: string) =>
  z
    .string({ error: `${name} is not set` })
    .trim()
    .min(1, { error: `${name} is not set` })

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform(v => (v ? v : undefined))

const envSchema = z.object({
  GITHUB_TOKEN: required('GITHUB_TOKEN'),
  ANTHROPIC_API_KEY: required('ANTHROPIC_API_KEY'),
  DAILY_CAP_USD: z.coerce
    .number({ error: 'DAILY_CAP_USD is not a number' })
    .nonnegative({ error: 'DAILY_CAP_USD is below zero' })
    .default(5),
  KV_REST_API_URL: optionalText,
  KV_REST_API_TOKEN: optionalText,
})

export interface Config {
  githubToken: string
  anthropicApiKey: string
  dailyCapUsd: number
  /** Vercel KV (Upstash Redis): both or neither. Without it, counters and cache are in memory (dev only). */
  kv: { url: string; token: string } | undefined
}

export interface ConfigProblem {
  variable: string
  message: string
}

export type ConfigResult = { ok: true; config: Config } | { ok: false; problems: ConfigProblem[] }

type Env = Record<string, string | undefined>

export function loadConfig(env: Env = process.env): ConfigResult {
  const parsed = envSchema.safeParse({
    GITHUB_TOKEN: env.GITHUB_TOKEN,
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
    DAILY_CAP_USD: env.DAILY_CAP_USD || undefined,
    KV_REST_API_URL: env.KV_REST_API_URL,
    KV_REST_API_TOKEN: env.KV_REST_API_TOKEN,
  })
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map(issue => ({
        variable: String(issue.path[0] ?? 'environment'),
        message: issue.message,
      })),
    }
  }
  const d = parsed.data
  return {
    ok: true,
    config: {
      githubToken: d.GITHUB_TOKEN,
      anthropicApiKey: d.ANTHROPIC_API_KEY,
      dailyCapUsd: d.DAILY_CAP_USD,
      kv: d.KV_REST_API_URL && d.KV_REST_API_TOKEN ? { url: d.KV_REST_API_URL, token: d.KV_REST_API_TOKEN } : undefined,
    },
  }
}
