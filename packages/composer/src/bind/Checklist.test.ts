// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { check, nextContext } from './testing'
import { draw } from './group-a-testing'
import { bindChecklist } from './Checklist'
import type { ChecklistProps } from './group-a-ui'

afterEach(cleanup)

describe('bindChecklist', () => {
  it('reads the community standards and the health percentage', async () => {
    const ctx = await nextContext()
    const { node, warnings } = check(bindChecklist(ctx, { title: 'Community standards', source: 'community-standards' }), 'side')
    expect(node.state).toBe('default')
    expect(warnings).toEqual([])
    const props = node.props as ChecklistProps
    expect(props.meta).toBe('GitHub community profile · 87% health')
    expect(props.items).toHaveLength(6)
    expect(props.items.filter(i => !i.passed).map(i => i.id)).toEqual(['issue-template'])
    expect(props.items.find(i => i.id === 'license')?.meta).toBe('MIT')
    expect(draw(node).container.textContent).toContain('standards in place')
  })

  it('is unavailable for a milestone next.js does not date, and for a release checklist', async () => {
    const ctx = await nextContext()
    const milestone = check(bindChecklist(ctx, { title: 'Next release', source: 'milestone' }), 'side').node
    expect(milestone.state).toBe('error')
    expect(milestone.error).toEqual({ failed: "Couldn't load the milestone", cause: 'This repo has no open milestone with a due date' })
    draw(milestone)
    expect(check(bindChecklist(ctx, { title: 'Release steps', source: 'release-checklist' }), 'side').node.state).toBe('error')
  })
})
