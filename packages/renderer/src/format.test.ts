import { describe, expect, it } from 'vitest'
import { registry } from '@genui-github/ui'
import { FIXTURES } from './fixtures'
import { compositionSchema, piecesOf } from './format'

describe('the three fixtures', () => {
  for (const [name, composition] of Object.entries(FIXTURES)) {
    it(`${name} validates as a Composition, and every piece's props pass its component schema under its derived id`, () => {
      expect(compositionSchema.safeParse(composition).error?.issues).toBeUndefined()
      for (const { piece } of piecesOf(composition.regions)) {
        const spec = registry.get(piece.component)!
        expect(spec.schema.safeParse(piece.props).error?.issues, piece.id).toBeUndefined()
        expect(registry.deriveId(piece.component, piece.props)).toBe(piece.id)
      }
    })
  }
})
