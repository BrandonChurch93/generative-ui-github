// `pnpm evals:check`: the regression gate. Reruns the 60 golden cases once on `production` and fails if template
// accuracy or bindings fall below the last recorded `production` run. Run before a commit touching the composer.
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createModelClient } from '@genui-github/composer'
import { createGitHubClient, memoryCache } from '@genui-github/data/server'
import { loadSet } from '../src/set'
import { aggregate, pool, runCase, type ResultsFile } from '../src/run'

const root = fileURLToPath(new URL('..', import.meta.url))
process.loadEnvFile(`${root}../../.env.local`)
const out = (s: string) => process.stdout.write(`${s}\n`)

const recorded = readdirSync(`${root}results`).filter(f => f.endsWith('-production.json')).sort().at(-1)
if (!recorded) throw new Error('No production results recorded yet: run pnpm evals:run --model production first')
const last = JSON.parse(readFileSync(`${root}results/${recorded}`, 'utf8')) as ResultsFile
const floor = { template: last.golden.pass.template?.min ?? 0, bindings: last.golden.pass.bindings?.min ?? 0 }

const deps = { models: createModelClient(), github: createGitHubClient({ token: process.env.GITHUB_TOKEN ?? '' }), cache: memoryCache() }
const golden = loadSet().filter(c => c.kind === 'golden')
const results = await pool(golden.map(c => () => runCase(c, 'production', deps)), 4)
const now = aggregate(results)
const got = { template: now.pass.template?.mean ?? 0, bindings: now.pass.bindings?.mean ?? 0 }

out(`against ${recorded}: template ${got.template} (floor ${floor.template}) · bindings ${got.bindings} (floor ${floor.bindings}) · $${now.cost.totalUsd}`)
const failing = results.filter(r => !r.scores.template?.pass || r.scores.bindings?.pass === false)
for (const r of failing) out(`  ${r.id}: ${[r.scores.template?.reason, r.scores.bindings?.reason, r.said].filter(Boolean).join(' · ')}`)
if (got.template < floor.template || got.bindings < floor.bindings) {
  out('evals:check failed: the golden cases regressed')
  process.exit(1)
}
out('evals:check passed')
