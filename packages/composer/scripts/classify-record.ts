// Runs the classifier live on the 12 golden questions and 20 paraphrases, prints the accuracy, and records the
// responses to fixtures/classify.json for the replay test. `pnpm --filter @genui-github/composer classify:record`
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createModelClient } from '../src/anthropic'
import { classify } from '../src/classify'
import { routingCases } from '../src/cases'
import { NEXT_SUMMARY } from '../src/fixtures'

const root = fileURLToPath(new URL('..', import.meta.url))
process.loadEnvFile(`${root}../../.env.local`)
const client = createModelClient()
const out = (s: string) => process.stdout.write(`${s}\n`)

const recorded = []
let right = 0
let cost = 0
for (const c of routingCases()) {
  const { result, usage } = await classify(client, { question: c.question, summary: NEXT_SUMMARY, ...(c.from ? { from: c.from } : {}) })
  const ok = result.template === c.template
  right += ok ? 1 : 0
  cost += usage.costUsd
  out(`${ok ? 'ok  ' : 'MISS'} ${c.id}: ${result.template} (${result.confidence.toFixed(2)}) ${usage.latencyMs}ms`)
  recorded.push({ question: c.question, result, usage })
}
writeFileSync(`${root}fixtures/classify.json`, `${JSON.stringify({ recordedAt: new Date().toISOString(), responses: recorded }, null, 1)}\n`)
out(`${right}/${recorded.length} right (${Math.round((right / recorded.length) * 100)}%) · $${cost.toFixed(5)}`)
