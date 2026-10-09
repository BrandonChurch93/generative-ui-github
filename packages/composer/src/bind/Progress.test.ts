// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { check, nextContext } from './testing'
import { draw } from './group-a-testing'
import { bindProgress } from './Progress'

afterEach(cleanup)

describe('bindProgress', () => {
  it('reads the failing checks on the default branch head as a part of a whole', async () => {
    const ctx = await nextContext()
    const { node, warnings } = check(bindProgress(ctx, { measure: 'failing-checks', label: 'Failing checks' }), 'side')
    expect(node.state).toBe('default')
    expect(warnings).toEqual([])
    expect(node.props).toMatchObject({ count: 57, total: 421, meta: 'canary head · 6469906' })
    expect(draw(node).container.textContent).toContain('14% failing')
  })

  it('is empty on purpose: next.js has no dated milestone', async () => {
    const ctx = await nextContext()
    const { node } = check(bindProgress(ctx, { measure: 'milestone-issues-open', label: 'Open on the milestone' }), 'side')
    expect(node.state).toBe('empty')
    expect(node.props).toMatchObject({ message: 'No release milestone with a due date' })
    draw(node)
  })

  it('is unavailable when the checks were not read', async () => {
    const ctx = await nextContext()
    const { checks: _c, ...shapes } = ctx.shapes
    const { node } = check(bindProgress({ ...ctx, shapes }, { measure: 'failing-checks', label: 'Failing checks' }), 'side')
    expect(node.state).toBe('error')
    expect(node.error).toEqual({ failed: "Couldn't load", cause: "Not in this answer's data" })
    draw(node)
  })
})
