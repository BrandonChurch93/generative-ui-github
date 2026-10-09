import { gsap } from 'gsap'
import { captureRows, draw, fade, MOVES, one, pop, prefersReducedMotion, rowsUpdate, slide, within, type PieceMotion } from '../../motion'
import type { TimelineProps } from './schema'

/** Day headings and rows, top to bottom, in the order they slide. */
const sliders = (root: HTMLElement) => within(root, '[data-day] > h3, [data-row]')

export const timelineMotion: PieceMotion<TimelineProps> = {
  capture: captureRows,
  enter(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const reduced = options.reduced ?? prefersReducedMotion()
    const parts = sliders(root)
    if (parts.length) tl.add(slide(parts, options), 0)
    const spine = one(root, '[data-spine]')
    const endpoint = one(root, '[data-row] [data-kind="endpoint"]')
    const nodes = within(root, '[data-row] [data-kind="node"]')
    if (reduced) {
      if (spine) tl.add(fade(spine), 0)
      return tl
    }
    if (spine) {
      tl.add(draw(spine, { ...options, axis: 'y' }), 0)
      // Each older node scales in as the spine reaches it.
      const top = spine.getBoundingClientRect().top
      const height = spine.getBoundingClientRect().height || 1
      for (const node of nodes) {
        const at = Math.min(1, Math.max(0, (node.getBoundingClientRect().top - top) / height))
        tl.fromTo(node, { scale: 0 }, { scale: 1, duration: 0.24, ease: MOVES.rise.ease }, at * MOVES.draw.in)
      }
    }
    // The newest node is the one point that bounces, as its row lands.
    if (endpoint) tl.add(pop(endpoint, options), MOVES.slide.in * 0.6)
    return tl
  },
  exit(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const spine = one(root, '[data-spine]')
    if (spine) tl.add(draw(spine, { ...options, axis: 'y', direction: 'out' }), 0)
    const parts = sliders(root)
    if (parts.length) tl.add(slide(parts, { ...options, direction: 'out' }), 0)
    return tl
  },
  update(root, prev, next, options = {}) {
    const tl = rowsUpdate(root, prev.items.map(i => i.id), options)
    const endpoint = one(root, '[data-row] [data-kind="endpoint"]')
    if (endpoint && prev.items[0]?.id !== next.items[0]?.id) tl.add(pop(endpoint, options), 0)
    return tl
  },
  morph: (root, prev, next, options) => timelineMotion.update(root, prev, next, options),
}
