// Task 5.9: `pnpm compositions:refresh` composes the 60 golden compositions (12 questions × 5 samples) offline
// from the committed samples, fills their prose once with Haiku, checks every tree, and writes them under
// packages/composer/golden/. The route serves these with zero model calls.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SAMPLE_REPOS } from '@genui-github/data/server'
import { createModelClient, sumUsage } from '../src/anthropic'
import { fill } from '../src/fill'
import { goldenPath } from '../src/golden'
import { enforceRules } from '../src/rules'
import { sampleContext } from '../src/samples'
import { needsFor, TEMPLATE_IDS, TEMPLATE_NEEDS } from '../src/templates/needs'
import { TEMPLATES } from '../src/templates/registry'
import { checkTree, chose } from '../src/templates/template'

const root = fileURLToPath(new URL('..', import.meta.url))
process.loadEnvFile(`${root}../../.env.local`)
const client = createModelClient()
const out = (s: string) => process.stdout.write(`${s}\n`)

const golden = TEMPLATE_IDS.filter(id => TEMPLATE_NEEDS[id].kind === 'golden')
let written = 0
let cost = 0
const bad: string[] = []
for (const repo of SAMPLE_REPOS) {
  for (const id of golden) {
    const question = TEMPLATE_NEEDS[id].question
    const started = Date.now()
    const { ctx, calls } = await sampleContext(repo, needsFor(id), { timeZone: 'UTC' })
    if (calls.length) throw new Error(`${repo.owner}/${repo.name} ${id} reached GitHub`)
    const screen = TEMPLATES[id]!.compose(ctx, {})
    const filled = await fill(client, ctx, screen, question)
    const usage = filled.usage ? [filled.usage] : []
    const { tokens, costUsd } = sumUsage(usage)
    cost += costUsd
    const composition = {
      id: `golden-${id}-${repo.name}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      density: filled.screen.density,
      regions: filled.screen.regions,
      asks: filled.screen.asks,
      built: {
        template: id,
        model: filled.usage?.model ?? 'none',
        tokens,
        costUsd: Number(costUsd.toFixed(6)),
        latencyMs: { classify: 0, data: 0, compose: Date.now() - started, total: Date.now() - started },
        githubReads: 0,
        chose: chose(filled.screen.regions),
      },
    }
    const { composition: kept, drops } = enforceRules(composition, { question })
    const check = checkTree(kept, { question })
    if (!check.ok || drops.length) {
      bad.push(`${repo.owner}/${repo.name} ${id}: ${[...check.problems, ...drops.map(d => d.rule)].join('; ')}`)
      continue
    }
    const path = goldenPath(repo, id)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, `${JSON.stringify(kept)}\n`)
    written += 1
    out(`${repo.name.padEnd(12)} ${id.padEnd(17)} kept ${filled.kept.length} refused ${filled.refused.length}`)
  }
}
out(`${written} written · ${bad.length} invalid · $${cost.toFixed(4)}`)
for (const b of bad) out(`INVALID ${b}`)
if (bad.length) process.exitCode = 1
