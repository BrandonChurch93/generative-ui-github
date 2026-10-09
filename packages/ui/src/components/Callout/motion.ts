import { gsap } from 'gsap'
import { draw, one, within, wipe, type PieceMotion } from '../../motion'
import type { CalloutProps } from './schema'

const words = (root: HTMLElement) => within(root, '[data-sentence], [data-meta]')

// Insight's moves: the sentence wipes while its rule draws top to bottom.
export const calloutMotion: PieceMotion<CalloutProps> = {
  enter(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const rule = one(root, '[data-rule]')
    if (rule) tl.add(draw(rule, { ...options, delay: 0, axis: 'y' }), 0)
    const text = words(root)
    if (text.length) tl.add(wipe(text, { ...options, delay: 0 }), 0)
    return tl
  },
  exit(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const text = words(root)
    if (text.length) tl.add(wipe(text, { ...options, delay: 0, direction: 'out' }), 0)
    const rule = one(root, '[data-rule]')
    if (rule) tl.add(draw(rule, { ...options, delay: 0, axis: 'y', direction: 'out' }), 0)
    return tl
  },
  // New words wipe in where the old ones stood; the rule stays. A changed tone is a new piece and enters fresh.
  update: (root, prev, next, options = {}) =>
    prev.text === next.text && prev.meta === next.meta ? gsap.timeline() : wipe(words(root), options),
  morph: (root, prev, next, options = {}) => calloutMotion.update(root, prev, next, options),
}
