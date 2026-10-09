import { gsap } from 'gsap'
import { draw, one, within, wipe, type PieceMotion } from '../../motion'
import type { InsightProps } from './schema'

const words = (root: HTMLElement) => within(root, '[data-sentence], [data-source]')

export const insightMotion: PieceMotion<InsightProps> = {
  enter(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const rule = one(root, '[data-rule]')
    if (rule) tl.add(draw(rule, { ...options, axis: 'y' }), 0)
    const text = words(root)
    if (text.length) tl.add(wipe(text, options), 0)
    return tl
  },
  exit(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const text = words(root)
    if (text.length) tl.add(wipe(text, { ...options, direction: 'out' }), 0)
    const rule = one(root, '[data-rule]')
    if (rule) tl.add(draw(rule, { ...options, axis: 'y', direction: 'out' }), 0)
    return tl
  },
  // A new answer wipes in where the old one stood; the rule stays.
  update: (root, _prev, _next, options = {}) => wipe(words(root), options),
  morph: (root, _prev, _next, options = {}) => wipe(words(root), options),
}
