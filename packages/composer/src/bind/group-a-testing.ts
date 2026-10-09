import { createElement } from 'react'
import { render, type RenderResult } from '@testing-library/react'
import { PIECES } from '@genui-github/ui/pieces'
import type { RenderNode } from '@genui-github/renderer/core'

// Group A's render check: the real component draws a validated node's bound props in its state.

export function draw(node: RenderNode): RenderResult {
  const { Component } = PIECES[node.component]!
  return render(createElement(Component, { props: node.props, state: node.state, error: node.error, ask: node.ask }))
}
