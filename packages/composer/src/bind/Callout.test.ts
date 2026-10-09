// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { check, nextContext } from './testing'
import { draw } from './group-a-testing'
import { bindCallout } from './Callout'
import type { CalloutProps } from './group-a-ui'

afterEach(cleanup)

describe('bindCallout', () => {
  it('lets the sentence cite the measures on screen and names them in the meta line', async () => {
    const ctx = await nextContext()
    const { node, warnings } = check(bindCallout(ctx, { tone: 'warn', text: '57 of 421 checks fail on `canary`.' }), 'main')
    expect(node.state).toBe('default')
    expect(warnings).toEqual([])
    expect((node.props as CalloutProps).meta).toBe('from failing checks')
    expect(draw(node).container.textContent).toContain('57 of 421 checks fail on canary.')
  })

  it('shows the system sentence for a figure no measure holds', async () => {
    const ctx = await nextContext()
    const { node } = check(bindCallout(ctx, { tone: 'crit', text: '9,999 checks fail on `canary`.' }), 'main')
    expect((node.props as CalloutProps).meta).toBeUndefined()
    expect(draw(node).container.textContent).toContain("The model's figure didn't match the data")
  })
})
