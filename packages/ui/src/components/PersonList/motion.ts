import { captureRows, count, one, rowsEnter, rowsExit, rowsUpdate, within, wipe, type MoveOptions, type PieceMotion } from '../../motion'
import type { PersonListProps } from './schema'

/** Shared by update and morph: rows move with Flip, new people slide in, and a count that changed runs from its old value. */
function refresh(root: HTMLElement, prev: PersonListProps, next: PersonListProps, options: MoveOptions & { captured?: unknown }) {
  const tl = rowsUpdate(root, prev.people.map(p => p.handle), options)
  const before = new Map(prev.people.map(p => [p.handle, p.count]))
  const after = new Map(next.people.map(p => [p.handle, p.count]))
  for (const row of within(root, '[data-row]')) {
    const handle = row.dataset.row ?? ''
    const node = one(row, '[data-count]')
    const [from, to] = [before.get(handle), after.get(handle)]
    if (node && from !== undefined && to !== undefined && from !== to) tl.add(count(node, { ...options, delay: 0, from, to }), 0)
  }
  return tl
}

export const personListMotion: PieceMotion<PersonListProps> = {
  capture: captureRows,
  enter: (root, _props, options) => rowsEnter(root, options),
  exit: (root, _props, options) => rowsExit(root, options),
  update: (root, prev, next, options = {}) => refresh(root, prev, next, options),
  morph(root, prev, next, options = {}) {
    const tl = refresh(root, prev, next, options)
    const title = one(root, '[data-card-head] h2, [data-card-head] h3')
    if (title && (prev.title !== next.title || prev.measure !== next.measure)) tl.add(wipe(title, { ...options, delay: 0 }), 0)
    return tl
  },
}
