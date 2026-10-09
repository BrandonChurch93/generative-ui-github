import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The classifier's test questions, read from the eval set's files. The evals package depends on this one,
// so the files are read directly instead of imported.

const SET_DIR = fileURLToPath(new URL('../../evals/set/', import.meta.url))

export interface RoutedCase {
  id: string
  question: string
  template: string
  from?: { id: string; ask: string }
}

/** The 12 golden questions (on next.js) and the 20 paraphrases: the questions 5.2 must route right. */
export function routingCases(): RoutedCase[] {
  return readdirSync(SET_DIR)
    .filter(f => /^(golden-\d+-nextjs|para-\d+)/.test(f))
    .sort()
    .map(f => {
      const c = JSON.parse(readFileSync(`${SET_DIR}${f}`, 'utf8')) as { id: string; question: string; expect: { template: string }; from?: RoutedCase['from'] }
      return { id: c.id, question: c.question, template: c.expect.template, ...(c.from ? { from: c.from } : {}) }
    })
}
