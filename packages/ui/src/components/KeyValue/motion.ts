import { captureRows, count, one, rowsEnter, rowsExit, rowsUpdate, wipe, type MoveOptions, type PieceMotion } from '../../motion'
import type { KeyValueProps } from './schema'

/** Shared by update and morph: pairs move with Flip, new pairs slide in, a changed count runs from its old value and changed words wipe. */
function refresh(root: HTMLElement, prev: KeyValueProps, next: KeyValueProps, options: MoveOptions & { captured?: unknown }) {
  const tl = rowsUpdate(root, prev.pairs.map(p => p.key), options)
  const inner = { ...options, delay: 0 }
  const before = new Map(prev.pairs.map(p => [p.key, p]))
  for (const pair of next.pairs) {
    const was = before.get(pair.key)
    const node = one(root, `[data-row="${CSS.escape(pair.key)}"] [data-value]`)
    if (!was || !node || was.value === pair.value) continue
    if (pair.kind === 'count' && typeof was.value === 'number' && typeof pair.value === 'number') {
      tl.add(count(node, { ...inner, from: was.value, to: pair.value }), 0)
    } else {
      tl.add(wipe(node, inner), 0)
    }
  }
  return tl
}

export const keyValueMotion: PieceMotion<KeyValueProps> = {
  capture: captureRows,
  enter: (root, _props, options) => rowsEnter(root, options),
  exit: (root, _props, options) => rowsExit(root, options),
  update: (root, prev, next, options = {}) => refresh(root, prev, next, options),
  morph(root, prev, next, options = {}) {
    const tl = refresh(root, prev, next, options)
    const title = one(root, '[data-card-head] h2, [data-card-head] h3')
    if (title && prev.title !== next.title) tl.add(wipe(title, { ...options, delay: 0 }), 0)
    return tl
  },
}
