// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { PIECES } from '@genui-github/ui/pieces'
import { bindSteps, systemSteps } from './Steps'
import { check, nextContext } from './testing'

afterEach(cleanup)

describe('bindSteps', () => {
  it('writes the new-contributor path from next.js data and binds it', async () => {
    const ctx = await nextContext()
    const steps = systemSteps(ctx)
    expect(steps.steps.map(s => s.id)).toEqual(['readme', 'contributing', 'code-of-conduct', 'good-first-issue', 'pull-request'])
    // The issue list holds none of next.js's good first issues, so the step links GitHub's label search with the exact count.
    const issue = steps.steps.find(s => s.id === 'good-first-issue')!
    expect(issue.fact).toBe('11 open')
    expect(issue.link).toMatchObject({ label: 'Good first issues' })
    expect(steps.steps.find(s => s.id === 'pull-request')!.fact).toBe('1.1h median wait')

    const { node, warnings } = check(bindSteps(ctx, steps))
    expect(warnings).toEqual([])
    expect(node.state).toBe('default')
    expect(node.id).toBe('steps:where-to-start')

    const { container } = render(createElement(PIECES.Steps!.Component, { props: node.props, state: node.state }))
    expect(container.querySelectorAll('li')).toHaveLength(5)
  })

  it('links a listed good first issue, and points at the issues list when there are none', async () => {
    const ctx = await nextContext()
    const open = ctx.shapes.issues!.open[0]!
    const listed = { ...ctx, measures: {}, shapes: { ...ctx.shapes, goodFirstIssues: { issues: [open], cachedAt: ctx.shapes.issues!.cachedAt } } }
    expect(systemSteps(listed).steps.find(s => s.id === 'good-first-issue')!.link).toEqual({ label: `Open #${open.number}`, href: open.url })

    const { readme: _r, community: _c, activity: _a, goodFirstIssues: _g, pulls: _p, ...shapes } = ctx.shapes
    const bare = systemSteps({ ...ctx, measures: {}, shapes })
    expect(bare.steps.map(s => s.id)).toEqual(['good-first-issue', 'pull-request'])
    expect(bare.steps[0]).toMatchObject({ title: 'Find an issue to work on', link: { label: 'Open issues', href: 'https://github.com/vercel/next.js/issues' } })
    expect(check(bindSteps(ctx, bare)).node.state).toBe('default')
  })
})
