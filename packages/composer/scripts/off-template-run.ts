// Task 5.5: composes the 10 off-template eval cases live with Sonnet on their sample repos, checks each tree,
// and records what Sonnet wrote to fixtures/off-template/<case>.jsonl for the replay test.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createModelClient, sumUsage } from '../src/anthropic'
import { composeOffTemplate } from '../src/offTemplate'
import { enforceRules } from '../src/rules'
import { sampleContext } from '../src/samples'
import { offTemplateNeeds } from '../src/templates/needs'
import { checkTree, chose } from '../src/templates/template'

const root = fileURLToPath(new URL('..', import.meta.url))
process.loadEnvFile(`${root}../../.env.local`)
const client = createModelClient()
const out = (s: string) => process.stdout.write(`${s}\n`)
const set = `${root}../evals/set/`
const cases = readdirSync(set).filter(f => f.startsWith('off-')).map(f => JSON.parse(readFileSync(set + f, 'utf8')) as { id: string; repo: string; question: string })
const only = process.argv.slice(2)
let valid = 0
for (const c of cases.filter(c => !only.length || only.includes(c.id))) {
  const [owner, name] = c.repo.split('/') as [string, string]
  const { ctx } = await sampleContext({ owner, name }, offTemplateNeeds(), { timeZone: 'America/Los_Angeles' })
  const started = Date.now()
  let first = 0
  const result = await composeOffTemplate(client, ctx, c.question, { onOp: () => (first ||= Date.now() - started) })
  writeFileSync(`${root}fixtures/off-template/${c.id}.jsonl`, result.raw.trim() + '\n')
  const { costUsd, tokens } = sumUsage([result.usage])
  const built = { template: 'off-template', reason: 'no template matched' as const, model: result.usage.model, tokens, costUsd, latencyMs: { classify: 0, data: 0, compose: result.usage.latencyMs, total: result.usage.latencyMs }, githubReads: 0, chose: chose(result.regions) }
  const { composition, drops } = enforceRules({ id: c.id, density: result.density, regions: result.regions, asks: result.asks, built }, { question: c.question })
  const check = checkTree(composition, { question: c.question })
  valid += check.ok ? 1 : 0
  out(`${check.ok ? 'ok  ' : 'BAD '} ${c.id} · ${chose(composition.regions).join(', ')} · first piece ${first}ms · done ${result.usage.latencyMs}ms · $${costUsd.toFixed(4)} · dropped ${result.dropped.length + drops.length}${check.ok ? '' : `\n     ${check.problems.join('\n     ')}`}`)
}
out(`${valid} valid`)
