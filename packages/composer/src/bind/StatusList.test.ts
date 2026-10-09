// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { check, nextContext } from './testing'
import { draw } from './group-a-testing'
import { bindStatusList } from './StatusList'
import type { StatusListProps } from './group-a-ui'

vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
afterEach(cleanup)

describe('bindStatusList', () => {
  it('lists the ready pull requests by wait when next.js has no dated milestone', async () => {
    const ctx = await nextContext()
    const { node, warnings } = check(bindStatusList(ctx, { kind: 'pull', title: 'Waiting on review', sort: 'wait', limit: 5 }))
    expect(node.state).toBe('default')
    expect(warnings).toEqual([])
    expect(node.id).toBe('statuslist:pull:all')
    const props = node.props as StatusListProps
    expect(props.meta).toBe('sorted by wait · ready for review')
    expect(props.items).toHaveLength(5)
    expect(props.items[0]).toMatchObject({ id: '93511', state: 'pending', ask: "What's holding #93511?" })
    expect(props.items[0]!.meta).toMatch(/^#93511 · .+ · waiting 156d$/)
    expect(draw(node).container.textContent).toContain('review pending')
  })

  it('binds issues, checks and workflows from their shapes', async () => {
    const ctx = await nextContext()
    const issues = check(bindStatusList(ctx, { kind: 'issue', title: 'Stale issues', sort: 'activity', limit: 8 }))
    expect(issues.warnings).toEqual([])
    expect((issues.node.props as StatusListProps).items.every(i => i.state === 'stale')).toBe(true)

    const checks = check(bindStatusList(ctx, { kind: 'check', title: 'Checks on canary', scope: { branch: 'canary' } }))
    const checkProps = checks.node.props as StatusListProps
    expect(checkProps.meta).toBe('57 of 421 failing · canary 6469906')
    expect(checkProps.items[0]!.state).toBe('failed')

    const workflows = check(bindStatusList(ctx, { kind: 'workflow', title: 'Workflows', scope: { window: '30d' } }))
    const row = (workflows.node.props as StatusListProps).items[0]!
    expect(row).toMatchObject({ id: 'build-and-test', title: 'build-and-test' })
    expect(row.trend).toHaveLength(12)
    expect(draw(workflows.node).container.textContent).toContain('build-and-test')
  })

  it('is empty on a milestone next.js does not have, and unavailable for checks on a pull request', async () => {
    const ctx = await nextContext()
    const none = check(bindStatusList(ctx, { kind: 'pull', title: 'Milestone pull requests', scope: { milestone: 'v16.2' }, emptyTone: 'good' }))
    expect(none.node.state).toBe('empty')
    expect(none.node.props).toMatchObject({ empty: 'No open pull requests on v16.2', emptyTone: 'good' })
    draw(none.node)

    const pr = check(bindStatusList(ctx, { kind: 'check', title: 'Checks', scope: { pr: 95360 } }))
    expect(pr.node.state).toBe('error')
    expect(pr.node.error).toEqual({ failed: "Couldn't load checks", cause: "Checks on #95360 are not in this answer's data" })
    expect(draw(pr.node).container.textContent).toContain('Checks')
  })
})
