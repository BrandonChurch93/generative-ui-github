// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { PIECES } from '@genui-github/ui/pieces'
import type { Form } from '@genui-github/ui/schemas'
import { bindForm } from './Form'
import { check, nextContext } from './testing'

afterEach(cleanup)

const scope: Form.FormModelProps = {
  title: 'Change scope',
  fields: [
    { component: 'TextInput', label: 'Repository', placeholder: 'owner/name', kind: 'identifier', validate: 'repo' },
    { component: 'Select', label: 'Milestone', options: [{ value: 'backlog', label: 'Backlog' }], value: 'backlog' },
    { component: 'FilterChips', label: 'Window', mode: 'single', options: [{ value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }], selected: ['7d'] },
  ],
  submit: 'Ask again',
  secondary: 'Reset',
  effect: 'replaces this screen',
}

describe('bindForm', () => {
  it('fills each field from the screen scope and counts the chips from recent merges', async () => {
    const ctx = await nextContext()
    const { node, warnings } = check(bindForm(ctx, scope))
    expect(warnings).toEqual([])
    expect(node.state).toBe('default')
    const [repo, milestone, window] = (node.props as { fields: Record<string, unknown>[] }).fields
    expect(repo).toMatchObject({ value: 'vercel/next.js' })
    expect(milestone).toMatchObject({ options: [{ value: 'backlog', meta: '7 open' }] })
    const merged7d = ctx.shapes.pulls!.merged.filter(p => Date.parse(p.mergedAt!) >= ctx.now - 7 * 86_400_000).length
    expect(window).toMatchObject({ counts: { '7d': merged7d } })

    const { container } = render(createElement(PIECES.Form!.Component, { props: node.props, state: node.state }))
    expect((container.querySelector('input') as HTMLInputElement).value).toBe('vercel/next.js')
  })

  it('shows chip labels without counts when nothing was read to count', async () => {
    const ctx = await nextContext()
    const { pulls: _p, commits: _c, ...shapes } = ctx.shapes
    const fields = (check(bindForm({ ...ctx, shapes }, scope)).node.props as { fields: Record<string, unknown>[] }).fields
    expect(fields[2]).toMatchObject({ counts: {} })
  })
})
