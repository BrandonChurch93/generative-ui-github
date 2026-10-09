import { existsSync, readFileSync } from 'node:fs'
import type { RepoRef } from '@genui-github/data/server'
import { canonicalSample, dirFrom, isSample } from '@genui-github/data/server'
import { compositionSchema, type Composition } from '@genui-github/renderer/core'
import { TEMPLATE_IDS, TEMPLATE_NEEDS, type TemplateId } from './templates/needs'

// The 60 golden compositions (12 questions on 5 sample repos), precomputed with the fill step by
// `pnpm compositions:refresh` and committed. The route serves them with zero model calls.

export const GOLDEN_DIR = dirFrom(import.meta.url, '../golden/')

const norm = (q: string) => q.toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim()

/** The golden template a question names word for word (case and punctuation aside), or null. */
export function goldenQuestion(question: string): TemplateId | null {
  const q = norm(question)
  return TEMPLATE_IDS.find(id => TEMPLATE_NEEDS[id].kind === 'golden' && norm(TEMPLATE_NEEDS[id].question) === q) ?? null
}

export const goldenPath = (repo: RepoRef, template: TemplateId) => {
  const r = canonicalSample(repo)
  return `${GOLDEN_DIR}${`${r.owner}__${r.name}`.toLowerCase()}/${template}.json`
}

/** The committed composition for a golden question on a sample repo, or null. */
export function goldenComposition(repo: RepoRef, question: string): Composition | null {
  const template = goldenQuestion(question)
  if (!template || !isSample(repo)) return null
  const path = goldenPath(repo, template)
  if (!existsSync(path)) return null
  const parsed = compositionSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')))
  return parsed.success ? parsed.data : null
}
