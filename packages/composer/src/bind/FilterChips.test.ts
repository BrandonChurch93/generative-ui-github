// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { PIECES } from '@genui-github/ui/pieces'
import { bindFilterChips } from './FilterChips'
import { check, nextContext } from './testing'

afterEach(cleanup)

const windows = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '52w', label: '1 year' },
]

describe('bindFilterChips', () => {
  it('counts the stale list by how long each issue has sat idle', async () => {
    const ctx = await nextContext()
    const piece = bindFilterChips(ctx, { target: 'statuslist:issue:all', mode: 'single', options: windows, selected: ['30d'] })
    const { node, warnings } = check(piece)
    expect(warnings).toEqual([])
    expect(node.state).toBe('default')
    const props = node.props as { counts: Record<string, number>; filters: string }
    const idle = (days: number) => ctx.shapes.issues!.open.filter(i => ctx.now - Date.parse(i.updatedAt) >= days * 86_400_000).length
    expect(props.counts).toEqual({ '30d': idle(30), '90d': idle(90), '52w': idle(364) })
    expect(props.counts['30d']).toBeGreaterThanOrEqual(props.counts['90d']!)
    expect(props.filters).toBe('open issues by time idle')

    const { container } = render(createElement(PIECES.FilterChips!.Component, { props: node.props, state: node.state }))
    expect(container.querySelectorAll('[role="radio"], button, input')).not.toHaveLength(0)
  })

  it('is unavailable when the target card has no data to count', async () => {
    const ctx = await nextContext()
    const { node } = check(bindFilterChips(ctx, { target: 'linechart:ci-p50', mode: 'single', options: windows, selected: ['30d'] }))
    expect(node.state).toBe('error')
  })
})
