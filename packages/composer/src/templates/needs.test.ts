import { describe, expect, it } from 'vitest'
import { isMeasureId, isShapeName } from '@genui-github/data'
import { TEMPLATE_IDS, TEMPLATE_NEEDS } from './needs'

describe('template needs', () => {
  it('lists the 15 templates, and every shape and measure they name exists in the data layer', () => {
    expect(TEMPLATE_IDS).toHaveLength(15)
    expect(Object.keys(TEMPLATE_NEEDS).sort()).toEqual([...TEMPLATE_IDS].sort())
    expect(TEMPLATE_IDS.filter(id => TEMPLATE_NEEDS[id].kind === 'golden')).toHaveLength(12)
    for (const id of TEMPLATE_IDS) {
      const { shapes, measures } = TEMPLATE_NEEDS[id]
      expect(shapes.filter(s => !isShapeName(s)), id).toEqual([])
      expect(measures.filter(m => !isMeasureId(m)), id).toEqual([])
    }
  })
})
