// Model ids per docs/decisions.md "Model routing". Sonnet id read from https://platform.claude.com on 2026-10-08.
export const MODELS = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-5-5',
} as const

export type ModelRole = keyof typeof MODELS
export type ModelId = (typeof MODELS)[ModelRole]
