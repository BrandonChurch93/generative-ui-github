import { captureRows, MOVES, one, pop, rowsEnter, rowsExit, rowsUpdate, wipe, type MoveOptions, type PieceMotion } from '../../motion'
import type { ActivityFeedProps } from './schema'

const endpointOf = (root: HTMLElement) => one(root, '[data-row] [data-kind="endpoint"]')

/** Shared by update and morph: new events slide in at the top, survivors move with Flip, and the newest point pops if it changed. */
function refresh(root: HTMLElement, prev: ActivityFeedProps, next: ActivityFeedProps, options: MoveOptions & { captured?: unknown } = {}) {
  const tl = rowsUpdate(root, prev.items.map(i => i.id), options)
  const endpoint = endpointOf(root)
  if (endpoint && prev.items[0]?.id !== next.items[0]?.id) tl.add(pop(endpoint, options), 0)
  return tl
}

export const activityFeedMotion: PieceMotion<ActivityFeedProps> = {
  capture: captureRows,
  enter(root, _props, options = {}) {
    const tl = rowsEnter(root, options)
    // The newest event is the one point that bounces, as its row lands.
    const endpoint = endpointOf(root)
    if (endpoint) tl.add(pop(endpoint, { ...options, delay: 0 }), MOVES.slide.in * 0.6)
    return tl
  },
  exit: (root, _props, options) => rowsExit(root, options),
  update: (root, prev, next, options) => refresh(root, prev, next, options),
  morph(root, prev, next, options = {}) {
    const tl = refresh(root, prev, next, options)
    const title = one(root, '[data-card-head] h2, [data-card-head] h3')
    if (title && prev.title !== next.title) tl.add(wipe(title, { ...options, delay: 0 }), 0)
    return tl
  },
}
