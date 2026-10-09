import { gsap } from 'gsap'
import { count, formatCount, slide, within, type MoveOptions, type PieceMotion } from '../../motion'
import type { FilterChipsProps } from './schema'

const chips = (root: HTMLElement) => within(root, '[data-chip], [data-more]')

/** Counts run from what each chip said to what it says now. A chip that had no count yet counts up from zero. */
export function countChips(root: HTMLElement, prev: Record<string, number> | undefined, next: Record<string, number> | undefined, options: MoveOptions = {}) {
  const tl = gsap.timeline()
  for (const node of within(root, '[data-count]')) {
    const value = node.dataset.count ?? ''
    const to = next?.[value]
    const from = prev?.[value] ?? 0
    if (to === undefined || to === from) continue
    tl.add(count(node, { ...options, from, to, format: v => formatCount(v, 0) }), 0)
  }
  return tl
}

export const filterChipsMotion: PieceMotion<FilterChipsProps> = {
  // Chips slide in from the left 70ms apart and leave the same way, like the Ask chips.
  enter: (root, _props, options = {}) => slide(chips(root), options),
  exit: (root, _props, options = {}) => slide(chips(root), { ...options, direction: 'out' }),
  update(root, prev, next, options = {}) {
    const tl = gsap.timeline()
    tl.add(countChips(root, prev.counts, next.counts, options), 0)
    const before = new Set(prev.options.map(o => o.value))
    const arrived = within(root, '[data-chip]').filter(c => !before.has(c.dataset.chip ?? ''))
    if (arrived.length) tl.add(slide(arrived, options), 0)
    return tl
  },
  morph: (root, prev, next, options) => filterChipsMotion.update(root, prev, next, options),
}
