'use client'

import type { Built } from '@genui-github/renderer'
import type { StreamTree } from '@genui-github/renderer'
import type { Served } from './useComposition'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  built?: Built
  tree: StreamTree
  question: string
  repo: string
  served: Served
}

/** "How this was built" (`screens/Drawer.html`). */
export function Drawer(_props: DrawerProps) {
  return null
}

export interface PieceDrawerContent {
  title: string
  items: string[]
}

/** A piece's "show all": the full list it could not fit. */
export function PieceDrawer(_props: { content: PieceDrawerContent | null; onClose: () => void }) {
  return null
}
