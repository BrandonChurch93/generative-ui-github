import { readdirSync, readFileSync } from 'node:fs'
import { createLogger } from '@genui-github/core'
import { dirFrom } from '@genui-github/data/server'
import type { ResultsFile, RunModel } from '@genui-github/evals'

const log = createLogger('web:evals')

export const MODEL_ORDER = ['production', 'sonnet', 'haiku'] as const satisfies readonly RunModel[]

const RESULTS_DIR = dirFrom(import.meta.url, '../../../../packages/evals/results/')

/** The newest results file per model, read at request time so a new run shows without a deploy. */
export function loadResults(dir = RESULTS_DIR): Partial<Record<RunModel, ResultsFile>> {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return {}
  }
  const out: Partial<Record<RunModel, ResultsFile>> = {}
  for (const model of MODEL_ORDER) {
    // `<date>-<model>.json`: the ISO date sorts, so the last name is the newest run.
    const newest = names.filter(n => n.endsWith(`-${model}.json`)).sort().at(-1)
    if (!newest) continue
    try {
      const file = JSON.parse(readFileSync(`${dir}${newest}`, 'utf8')) as ResultsFile
      if (file.model === model && Array.isArray(file.cases) && file.aggregate) out[model] = file
      else log.warn('results file does not match its name', { file: newest })
    } catch (error) {
      log.warn('results file did not parse', { file: newest, error: (error as Error).message })
    }
  }
  return out
}
