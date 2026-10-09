import { describe, expect, it } from 'vitest'
import { A2UI_CATALOG_ID, A2UI_ROOT_ID, A2UI_VERSION, fromA2UI, toA2UI, type A2UIComponent, type A2UIMessage } from './a2ui'
import { FIXTURES } from './fixtures'
import { piecesOf } from './format'

const jsonl = (messages: A2UIMessage[]): A2UIMessage[] =>
  messages
    .map(m => JSON.stringify(m))
    .join('\n')
    .split('\n')
    .map(line => JSON.parse(line) as A2UIMessage)

describe('A2UI adapter', () => {
  for (const [name, composition] of Object.entries(FIXTURES)) {
    it(`${name} round trips losslessly, directly and through JSONL`, () => {
      const messages = toA2UI(composition)
      expect(fromA2UI(messages)).toStrictEqual(composition)
      const wire = jsonl(messages)
      expect(wire).toStrictEqual(messages)
      expect(fromA2UI(wire)).toStrictEqual(composition)
    })
  }

  it('emits v0.9 messages: createSurface first, one root, every child id defined once, every piece reachable', () => {
    const composition = FIXTURES.releaseBlockers
    const messages = toA2UI(composition)
    for (const m of messages) {
      expect(m.version).toBe(A2UI_VERSION)
      expect(Object.keys(m).filter(k => k !== 'version')).toHaveLength(1)
    }
    const first = messages[0]
    expect(first && 'createSurface' in first && first.createSurface).toMatchObject({
      surfaceId: composition.id,
      catalogId: A2UI_CATALOG_ID,
    })

    const components: A2UIComponent[] = messages.flatMap(m => ('updateComponents' in m ? m.updateComponents.components : []))
    const ids = components.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.filter(id => id === A2UI_ROOT_ID)).toHaveLength(1)

    const byId = new Map(components.map(c => [c.id, c]))
    const reached = new Set<string>()
    const walk = (id: string): void => {
      const entry = byId.get(id)
      expect(entry, `child id ${id}`).toBeDefined()
      reached.add(id)
      const children = entry?.children
      if (Array.isArray(children)) children.forEach(walk)
    }
    walk(A2UI_ROOT_ID)
    expect(reached.size).toBe(components.length)
    for (const { piece } of piecesOf(composition.regions)) expect(reached.has(piece.id)).toBe(true)
  })

  it('throws a clear error when the messages carry no data model to rebuild from', () => {
    const withoutData = toA2UI(FIXTURES.contributors).filter(m => !('updateDataModel' in m))
    expect(() => fromA2UI(withoutData)).toThrow(/do not rebuild a valid composition · invalid at asks, built/)
  })
})
