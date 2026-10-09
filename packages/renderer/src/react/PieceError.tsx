'use client'

import { CardFrame, StateRow } from '@genui-github/ui'
import { PIECE_ERRORS, type RenderNode } from '../validate'

/**
 * The card for a piece that has no error state of its own to show: an unknown component, or one that
 * threw on what it was given. The frame still renders, so the reader sees what failed.
 */
export function PieceError({ node }: { node: RenderNode }) {
  const error = node.error ?? PIECE_ERRORS.props(node.component)
  return (
    <CardFrame as="section" ariaLabel={error.failed}>
      <StateRow kind="error" title={error.failed} meta={error.cause} />
    </CardFrame>
  )
}
