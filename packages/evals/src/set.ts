import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

// The eval set from docs/evals.md, as data: one JSON per case in packages/evals/set/. Phase 7 scores it.

export const CASE_KINDS = ['golden', 'paraphrase', 'off-template', 'cannot-answer', 'follow-up'] as const

export const caseSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    repo: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
    question: z.string().min(1).max(200),
    kind: z.enum(CASE_KINDS),
    /** A follow-up comes from a click: the piece and the question it asked. */
    from: z.object({ id: z.string().min(1), ask: z.string().min(1) }).strict().optional(),
    expect: z
      .object({
        template: z.string().min(1),
        /** The composed component multiset; absent where the composer is free to choose (off-template). */
        components: z.array(z.string().min(1)).optional(),
        hot: z.array(z.string().min(1)).optional(),
        /** `equals` is a path into the DataContext, such as `measures.failing-checks.value`. */
        bindings: z.array(z.object({ id: z.string().min(1), prop: z.string().min(1), equals: z.string().min(1) }).strict()).optional(),
        sources: z.array(z.string().min(1)).optional(),
        /** What the reader is told instead of a composition (a private or missing repo). */
        error: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict()
export type EvalCase = z.infer<typeof caseSchema>

export const SET_DIR = fileURLToPath(new URL('../set/', import.meta.url))

/** Every case, validated. Throws with the file name on the first invalid one: the set is ours, not the model's. */
export function loadSet(dir = SET_DIR): EvalCase[] {
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(file => {
      const parsed = caseSchema.safeParse(JSON.parse(readFileSync(`${dir}${file}`, 'utf8')))
      if (!parsed.success) throw new Error(`${file}: ${parsed.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join('; ')}`)
      if (`${parsed.data.id}.json` !== file) throw new Error(`${file}: id ${parsed.data.id} does not match the file name`)
      return parsed.data
    })
}
