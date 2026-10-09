// `pnpm evals:run --model <production|sonnet|haiku> --runs 3`: every case through the composer, scored, written
// to packages/evals/results/<date>-<model>.json. Spends real money; the cost prints as it goes.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createModelClient } from '@genui-github/composer'
import { createGitHubClient, memoryCache } from '@genui-github/data/server'
import { loadSet } from '../src/set'
import { pool, resultsFile, RUN_MODELS, runCase, type CaseResult, type RunModel } from '../src/run'

const root = fileURLToPath(new URL('..', import.meta.url))
process.loadEnvFile(`${root}../../.env.local`)

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const model = (arg('model') ?? 'production') as RunModel
if (!RUN_MODELS.includes(model)) throw new Error(`--model is one of ${RUN_MODELS.join(', ')}`)
const runs = Number(arg('runs') ?? 3)
const only = arg('only')
const concurrency = Number(arg('concurrency') ?? 4)
const out = (s: string) => process.stdout.write(`${s}\n`)

const set = loadSet().filter(c => !only || c.id.startsWith(only))
const deps = {
  models: createModelClient(),
  github: createGitHubClient({ token: process.env.GITHUB_TOKEN ?? '' }),
  cache: memoryCache(),
}

const results: CaseResult[] = []
let spent = 0
for (let run = 1; run <= runs; run++) {
  const started = Date.now()
  const batch = await pool(
    set.map(c => async () => {
      const r = await runCase(c, model, deps, run)
      spent += r.costUsd
      return r
    }),
    concurrency,
    done => {
      if (done % 10 === 0 || done === set.length) out(`${model} run ${run} · ${done}/${set.length} · $${spent.toFixed(4)} so far`)
    },
  )
  results.push(...batch)
  const failed = batch.filter(r => r.outcome === 'failed')
  out(`${model} run ${run} done in ${Math.round((Date.now() - started) / 1000)}s · ${failed.length} failed${failed.length ? `: ${failed.map(f => `${f.id} (${f.said})`).join('; ')}` : ''}`)
}

const file = resultsFile(model, results)
mkdirSync(`${root}results`, { recursive: true })
const path = `${root}results/${file.date.slice(0, 10)}-${model}.json`
writeFileSync(path, `${JSON.stringify(file, null, 1)}\n`)
const a = file.aggregate
out(`wrote ${path}`)
out(`template ${a.pass.template?.mean} · components ${a.pass.components?.mean} (F1 ${a.componentsF1}) · hot ${a.pass.hot?.mean} · schema ${a.pass.schema?.mean} · bindings ${a.pass.bindings?.mean} · numbers ${a.pass.numbers?.mean} · rules ${a.pass.rules?.mean}`)
out(`done p50 ${a.latency.doneP50}ms p90 ${a.latency.doneP90}ms · first piece p50 ${a.latency.firstPieceP50}ms · $${a.cost.totalUsd} total, $${a.cost.perCompositionUsd} each`)
