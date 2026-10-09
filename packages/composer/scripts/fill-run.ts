// Task 5.4: runs the fill step live, `--runs=N` times (default 100) over the golden templates on the five
// samples, and audits every finished tree for a figure its data does not hold. Writes fixtures/fill-runs.json.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SAMPLE_REPOS } from '@genui-github/data/server'
import { createModelClient } from '../src/anthropic'
import { fill, unvalidatedFigures } from '../src/fill'
import { sampleContext } from '../src/samples'
import { needsFor, TEMPLATE_IDS, TEMPLATE_NEEDS } from '../src/templates/needs'
import { TEMPLATES } from '../src/templates/registry'

const root = fileURLToPath(new URL('..', import.meta.url))
process.loadEnvFile(`${root}../../.env.local`)
const runs = Number(process.argv.find(a => a.startsWith('--runs='))?.split('=')[1] ?? 100)
const client = createModelClient()
const out = (s: string) => process.stdout.write(`${s}\n`)

const golden = TEMPLATE_IDS.filter(id => TEMPLATE_NEEDS[id].kind === 'golden')
const pairs = SAMPLE_REPOS.flatMap(repo => golden.map(id => ({ repo, id })))
let kept = 0
let refused = 0
let cost = 0
const leaks: string[] = []
const refusals: Record<string, number> = {}
const latencies: number[] = []
for (let i = 0; i < runs; i++) {
  const { repo, id } = pairs[i % pairs.length]!
  const { ctx } = await sampleContext(repo, needsFor(id), { timeZone: 'America/Los_Angeles' })
  const screen = TEMPLATES[id]!.compose(ctx, {})
  const result = await fill(client, ctx, screen, TEMPLATE_NEEDS[id].question)
  kept += result.kept.length
  refused += result.refused.length
  cost += result.usage?.costUsd ?? 0
  if (result.usage) latencies.push(result.usage.latencyMs)
  for (const r of result.refused) for (const p of r.problems) refusals[p.replace(/: .*/, '')] = (refusals[p.replace(/: .*/, '')] ?? 0) + 1
  const leak = unvalidatedFigures(result.screen, ctx)
  leaks.push(...leak.map(l => `${repo.owner}/${repo.name} ${id} ${l}`))
  out(`${String(i + 1).padStart(3)} ${repo.name.padEnd(12)} ${id.padEnd(17)} kept ${result.kept.length} refused ${result.refused.length} ${result.usage?.latencyMs ?? 0}ms${leak.length ? ` LEAK ${leak.join('; ')}` : ''}`)
}
latencies.sort((a, b) => a - b)
const summary = { ranAt: new Date().toISOString(), runs, kept, refused, refusals, unvalidated: leaks, costUsd: Number(cost.toFixed(5)), latencyMs: { p50: latencies[Math.floor(latencies.length / 2)], p90: latencies[Math.floor(latencies.length * 0.9)] } }
writeFileSync(`${root}fixtures/fill-runs.json`, `${JSON.stringify(summary, null, 1)}\n`)
out(JSON.stringify(summary))
