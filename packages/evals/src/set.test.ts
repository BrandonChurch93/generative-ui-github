import { describe, expect, it } from 'vitest'
import { TEMPLATE_IDS } from '@genui-github/composer'
import { registry } from '@genui-github/ui/registry'
import { loadSet } from './set'

describe('the eval set', () => {
  const set = loadSet()

  it('loads 99 cases that validate, in the counts docs/evals.md gives', () => {
    const count = (kind: string) => set.filter(c => c.kind === kind).length
    expect(set).toHaveLength(99)
    expect([count('golden'), count('paraphrase'), count('off-template'), count('cannot-answer'), count('follow-up')]).toEqual([60, 20, 10, 3, 6])
    expect(new Set(set.map(c => c.id)).size).toBe(99)
  })

  it('names only templates the composer has and components the registry has', () => {
    const templates = new Set<string>([...TEMPLATE_IDS, 'off-template'])
    for (const c of set) {
      expect(templates.has(c.expect.template), c.id).toBe(true)
      for (const name of c.expect.components ?? []) expect(registry.get(name), `${c.id} ${name}`).toBeDefined()
    }
    expect(set.filter(c => c.kind === 'follow-up').every(c => c.from)).toBe(true)
  })
})
