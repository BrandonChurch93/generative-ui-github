import { describe, expect, it } from 'vitest'
import { unbound } from './index'

describe('binders', () => {
  it('cover every component the model may pick', () => {
    expect(unbound()).toEqual([])
  })
})
