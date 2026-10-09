// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { check, nextContext } from './testing'
import { draw } from './group-a-testing'
import { bindActivityFeed } from './ActivityFeed'
import type { ActivityFeedProps } from './group-a-ui'

afterEach(cleanup)

describe('bindActivityFeed', () => {
  it('streams the last 7 days of openings and reviews, newest first', async () => {
    const ctx = await nextContext()
    const { node, warnings } = check(bindActivityFeed(ctx, { scope: { window: '7d' }, limit: 6 }), 'side')
    expect(node.state).toBe('default')
    expect(warnings).toEqual([])
    const props = node.props as ActivityFeedProps
    expect(props).toMatchObject({ title: 'Recent activity', meta: 'last 7 days', now: '2026-10-09T09:00:00.000Z' })
    expect(props.items).toHaveLength(6)
    expect(props.items[0]).toMatchObject({ actor: 'sokra', verb: 'opened', object: { kind: 'pull', ref: '#99910' } })
    expect(props.items.map(i => i.when)).toEqual([...props.items.map(i => i.when)].sort().reverse())
    expect(draw(node).container.textContent).toContain('sokra')
  })

  it('narrows to one person, and is empty for a milestone with no activity', async () => {
    const ctx = await nextContext()
    const mine = check(bindActivityFeed(ctx, { scope: { author: 'lukesandberg', window: '30d' } }), 'side').node.props as ActivityFeedProps
    expect(mine.items.length).toBeGreaterThan(0)
    expect(mine.items.every(i => i.actor === 'lukesandberg')).toBe(true)

    const { node } = check(bindActivityFeed(ctx, { scope: { milestone: 'v16.2' } }), 'side')
    expect(node.state).toBe('empty')
    expect(node.props).toMatchObject({ title: 'Activity on v16.2', empty: 'Nothing happened on v16.2 in the last 7 days' })
    draw(node)
  })

  it('is unavailable when neither pulls nor issues were read', async () => {
    const ctx = await nextContext()
    const { pulls: _p, issues: _i, ...shapes } = ctx.shapes
    const { node } = check(bindActivityFeed({ ...ctx, shapes }, {}), 'side')
    expect(node.state).toBe('error')
    expect(node.error?.failed).toBe("Couldn't load recent activity")
    draw(node)
  })
})
