import { gsap } from 'gsap'
import { bloom, fade, one, within, wipe, type PieceMotion } from '../../motion'
import type { ActionCardProps } from './schema'

const words = (root: HTMLElement) => within(root, '[data-wipe]')

export const actionCardMotion: PieceMotion<ActionCardProps> = {
  // The card rises (the renderer's wrapper), then blooms; heading, copy and confirm line wipe. Nothing bounces.
  enter(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const layer = one(root, '[data-bloom]')
    if (layer) tl.add(bloom(layer, options), 0)
    const text = words(root)
    if (text.length) tl.add(wipe(text, options), 0)
    return tl
  },
  exit(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const layer = one(root, '[data-bloom]')
    if (layer) tl.add(fade(layer, 'out'), 0)
    return tl
  },
  // The card's own phases animate from inside the component; a data update re-wipes the words.
  update: (root, _prev, _next, options = {}) => wipe(words(root), options),
  // Same effect keeps its state untouched; a changed effect gets a new id and enters fresh.
  morph: () => gsap.timeline(),
}
