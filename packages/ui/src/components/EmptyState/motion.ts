import { gsap } from 'gsap'
import { one, slide, wipe, type PieceMotion } from '../../motion'
import type { EmptyStateProps } from './schema'

const row = (root: HTMLElement) => one(root, '[data-state-row]')
const words = (root: HTMLElement) => row(root)?.lastElementChild ?? null

// The one row arrives the way a list's empty row does: it slides in from the left after the card rises.
export const emptyStateMotion: PieceMotion<EmptyStateProps> = {
  enter(root, _props, options = {}) {
    const target = row(root)
    return target ? slide(target, options) : gsap.timeline()
  },
  exit(root, _props, options = {}) {
    const target = row(root)
    return target ? slide(target, { ...options, direction: 'out' }) : gsap.timeline()
  },
  // New words wipe in beside the mark, which stays unless the tone changed.
  update(root, prev, next, options = {}) {
    const target = words(root)
    const same = prev.sentence === next.sentence && prev.detail === next.detail
    return target && !same ? wipe(target, options) : gsap.timeline()
  },
  morph: (root, prev, next, options = {}) => emptyStateMotion.update(root, prev, next, options),
}
