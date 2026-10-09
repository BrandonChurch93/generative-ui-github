import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createRegistry } from './registry'

const dummy = {
  name: 'Dummy',
  schema: z.object({ measure: z.string(), label: z.string().max(28) }).strict(),
  when: 'A placeholder that proves the registry works.',
  heightClass: 'fixed' as const,
  pickable: true,
  statesOmitted: [{ state: 'warming' as const, reason: 'A dummy never waits on GitHub.' }],
  id: { key: (p: { measure: string }) => p.measure },
  example: { measure: 'open-prs', label: 'Open pull requests' },
}

describe('registry', () => {
  it('registers a spec and reads it back', () => {
    const r = createRegistry()
    r.register(dummy)
    expect(r.get('Dummy')?.when).toBe(dummy.when)
    expect(r.heightClass('Dummy')).toBe('fixed')
    expect(r.get('Dummy')?.statesOmitted).toEqual(dummy.statesOmitted)
    expect(() => r.register(dummy)).toThrow('Dummy is already registered')
  })

  it('derives a stable id from the data key, and from the props when there is none', () => {
    const r = createRegistry()
    r.register(dummy)
    r.register({ name: 'Keyless', schema: z.object({ a: z.number(), b: z.number() }), when: 'x', pickable: false })
    expect(r.deriveId('Dummy', { measure: 'failing-checks', label: 'Failing checks' })).toBe('dummy:failing-checks')
    expect(r.deriveId('Keyless', { a: 1, b: 2 })).toBe(r.deriveId('Keyless', { b: 2, a: 1 }))
    expect(r.deriveId('Keyless', { a: 1, b: 2 })).not.toBe(r.deriveId('Keyless', { a: 1, b: 3 }))
  })

  it('puts pickable specs in the prompt and leaves the rest out', () => {
    const r = createRegistry()
    r.register(dummy)
    r.register({ ...dummy, name: 'Hidden', pickable: false })
    const prompt = r.toPrompt()
    expect(prompt).toContain('## Dummy')
    expect(prompt).toContain('"maxLength":28')
    expect(prompt).not.toContain('Hidden')
  })
})
