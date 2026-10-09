// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { PIECES } from '@genui-github/ui/pieces'
import { bindTimeline } from './Timeline'
import { check, nextContext } from './testing'

afterEach(cleanup)

describe('bindTimeline', () => {
  it('binds this week of merges from the day groups, newest first, on the context clock and zone', async () => {
    const ctx = await nextContext()
    const piece = bindTimeline(ctx, { title: 'Merged this week', kind: 'merged', limit: 8, dayAsk: 'What merged on {day}?' })
    const { node, warnings } = check(piece)
    expect(warnings).toEqual([])
    expect(node.state).toBe('default')
    const props = node.props as { items: { id: string; author: string; add: number; verb: string }[]; now: string; timeZone: string; meta: string }
    expect(props.items).toHaveLength(8)
    expect(props.items[0]).toMatchObject({ id: '99886', author: 'bgw', add: 15, verb: 'merged' })
    expect(props.now).toBe('2026-10-09T09:00:00.000Z')
    expect(props.timeZone).toBe('America/Los_Angeles')
    expect(props.meta).toBe('last 7 days')
    expect(piece.id).toBe('timeline:merged:all')

    const { container } = render(createElement(PIECES.Timeline!.Component, { props: node.props, state: node.state }))
    expect(container.querySelectorAll('[data-row]')).toHaveLength(8)
  })

  it('binds an empty state, not an error, when the repo has no two releases to compare', async () => {
    const ctx = await nextContext()
    const bare = { ...ctx, scope: { release: true }, shapes: { ...ctx.shapes, commitsBetweenTags: undefined, releases: { releases: [], tags: [], cachedAt: new Date(ctx.now).toISOString() } } }
    const { node } = check(bindTimeline(bare, { title: 'Commits in this release', kind: 'commits', limit: 8 }))
    expect(node.state).toBe('empty')
    expect((node.props as { empty: string }).empty).toBe('No two releases to compare yet')
  })

  it('binds the commits between the last two releases with short SHAs', async () => {
    const ctx = await nextContext()
    const piece = bindTimeline({ ...ctx, scope: { release: true } }, { title: 'Commits in this release', kind: 'commits', limit: 8 })
    const { node, warnings } = check(piece)
    expect(warnings).toEqual([])
    expect(node.state).toBe('default')
    const props = node.props as { items: { id: string; title: string; verb: string }[]; meta: string }
    expect(props.items).toHaveLength(4)
    expect(props.items.every(i => i.id.length === 7)).toBe(true)
    expect(props.meta).toBe('v16.5.0-canary.4 to v16.5.0-canary.5')
  })

  it('is empty for a milestone nothing merged into, and unavailable when the merges were not read', async () => {
    const ctx = await nextContext()
    const none = check(bindTimeline(ctx, { title: 'Merged into v99', kind: 'merged', scope: { milestone: 'v99' } }))
    expect(none.node.state).toBe('empty')
    expect((none.node.props as { empty: string }).empty).toBe('Nothing merged into v99 yet')

    const { pulls: _pulls, mergedByDay: _byDay, ...shapes } = ctx.shapes
    const missing = check(bindTimeline({ ...ctx, shapes }, { title: 'Merged this week', kind: 'merged' }))
    expect(missing.node.state).toBe('error')
    expect(missing.node.error).toEqual({ failed: "Couldn't load merged pull requests", cause: "Not in this answer's data" })
  })
})
