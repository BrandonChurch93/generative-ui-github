// @vitest-environment node
import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import { MODELS } from '@genui-github/core'
import { MEASURE_IDS } from '@genui-github/data'
import { registry } from './specs'

// Vitest runs from the package directory. The key lives in the repo root's .env.local, which is never committed.
const envFile = resolve(process.cwd(), '../../.env.local')
if (!process.env.ANTHROPIC_API_KEY && existsSync(envFile)) process.loadEnvFile(envFile)
const hasKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim())

const CHAR_BUDGET = 24_000
const TOKEN_BUDGET = 7_000

describe('registry prompt', () => {
  const prompt = registry.toPrompt()

  it('lists the measure catalog and every pickable component, and nothing else', () => {
    for (const id of MEASURE_IDS) expect(prompt).toContain(`${id} · `)
    for (const spec of registry.all()) {
      if (spec.pickable) expect(prompt).toContain(`## ${spec.name} · `)
      else expect(prompt).not.toContain(`## ${spec.name} · `)
    }
  })

  it(`stays under ${CHAR_BUDGET.toLocaleString('en-US')} characters`, () => {
    expect(prompt.length).toBeLessThan(CHAR_BUDGET)
  })

  it.skipIf(!hasKey)(`counts under ${TOKEN_BUDGET.toLocaleString('en-US')} tokens with the Anthropic count endpoint`, async () => {
    const client = new Anthropic()
    const { input_tokens } = await client.messages.countTokens({
      model: MODELS.sonnet,
      messages: [{ role: 'user', content: prompt }],
    })
    writeFileSync(
      resolve(process.cwd(), 'fixtures/prompt-tokens.json'),
      `${JSON.stringify({ model: MODELS.sonnet, characters: prompt.length, inputTokens: input_tokens, countedAt: new Date().toISOString() }, null, 2)}\n`,
    )
    expect(input_tokens).toBeLessThan(TOKEN_BUDGET)
  }, 30_000)

  it.skipIf(hasKey)('skips the token count: ANTHROPIC_API_KEY is not set', () => {
    expect(hasKey).toBe(false)
  })
})
