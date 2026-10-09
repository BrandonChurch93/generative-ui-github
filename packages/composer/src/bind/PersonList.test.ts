// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { check, nextContext } from './testing'
import { draw } from './group-a-testing'
import { bindPersonList } from './PersonList'
import type { PersonListProps } from './group-a-ui'

afterEach(cleanup)

describe('bindPersonList', () => {
  it('lists the most commits over 90 days from the contributor share', async () => {
    const ctx = await nextContext()
    const { node, warnings } = check(bindPersonList(ctx, { measure: 'commits', limit: 5 }), 'side')
    expect(node.state).toBe('default')
    expect(warnings).toEqual([])
    const props = node.props as PersonListProps
    expect(props.meta).toBe('last 90 days')
    expect(props.people.slice(0, 3).map(p => [p.handle, p.count])).toEqual([['sokra', 114], ['eps1lon', 105], ['lukesandberg', 103]])
    expect(props.people[0]!.ask).toBe('What is sokra working on?')
    expect(draw(node).container.textContent).toContain('sokra')
  })

  it('reads issue authors from the listed issues and says so', async () => {
    const ctx = await nextContext()
    const props = check(bindPersonList(ctx, { measure: 'issues' }), 'side').node.props as PersonListProps
    expect(props.meta).toBe('last 30 days · listed issues')
    expect(props.people[0]).toMatchObject({ handle: 'agentHits', count: 5 })
  })

  it('is unavailable when the contributor stats were not read', async () => {
    const ctx = await nextContext()
    const { contributorShare: _share, ...shapes } = ctx.shapes
    const { node } = check(bindPersonList({ ...ctx, shapes }, { measure: 'reviews' }), 'side')
    expect(node.state).toBe('error')
    expect(node.error).toEqual({ failed: "Couldn't load reviewers", cause: "Not in this answer's data" })
    expect(draw(node).container.textContent).toContain('Most reviews')
  })
})
