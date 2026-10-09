import { describe, expect, it } from 'vitest'
import * as mod from './index'

describe('package entry', () => {
  it('loads', () => {
    expect(mod).toBeTypeOf('object')
  })
})
