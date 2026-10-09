import { createElement } from 'react'
import { render, type RenderResult } from '@testing-library/react'
import { vi } from 'vitest'
import { PIECES } from '@genui-github/ui/pieces'
import type { DataContext } from './types'
import type { check } from './testing'

// Group B's render helper: draws a checked piece with the real component, as the renderer would.

export function draw(node: ReturnType<typeof check>['node']): RenderResult {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  return render(createElement(PIECES[node.component]!.Component, { props: node.props, state: node.state, error: node.error }))
}

/** The context with some shapes never fetched. */
export const without = (ctx: DataContext, ...names: (keyof DataContext['shapes'])[]): DataContext => ({
  ...ctx,
  shapes: Object.fromEntries(Object.entries(ctx.shapes).filter(([k]) => !names.includes(k as keyof DataContext['shapes']))),
})
