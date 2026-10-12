// `pnpm evals:rescore <file>`: applies the current `NOT_SCORED` to a recorded results file and recomputes its
// aggregates, so a change to which scorers apply needs no paid rerun. Every case's measured outcome stays as recorded.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resultsFile, unscored, type ResultsFile } from '../src/run'

const root = fileURLToPath(new URL('..', import.meta.url))
const name = process.argv[2]
if (!name) throw new Error('Name a results file, for example pnpm evals:rescore 2026-10-12-sonnet.json')
const path = resolve(`${root}results`, name)
const file = JSON.parse(readFileSync(path, 'utf8')) as ResultsFile
const next = resultsFile(file.model, file.cases.map(c => unscored(file.model, c)), file.date)
writeFileSync(path, `${JSON.stringify({ ...next, models: file.models }, null, 1)}\n`)
process.stdout.write(`rescored ${name}: not scored ${Object.keys(next.notScored ?? {}).join(', ') || 'nothing'}\n`)
