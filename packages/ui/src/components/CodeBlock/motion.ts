import { gsap } from 'gsap'
import {
  captureRows,
  EASE,
  fade,
  INTERACTION,
  MOVES,
  one,
  prefersReducedMotion,
  rowsUpdate,
  slide,
  wipe,
  within,
  type MoveOptions,
  type PieceMotion,
} from '../../motion'
import { splitLines } from './code'
import type { CodeBlockProps } from './schema'

const reducedFor = (options: MoveOptions) => options.reduced ?? prefersReducedMotion()

/** The lines land as one block, so a long snippet still arrives in under a second; then the fold or the one state row. */
const blocksOf = (root: HTMLElement) => within(root, '[data-lines], [data-fold], [data-state-row]')

function arrive(root: HTMLElement, options: MoveOptions): gsap.core.Timeline {
  const tl = gsap.timeline({ delay: options.delay ?? 0 })
  const now = { ...options, delay: 0 }
  const path = one(root, '[data-path]')
  if (path) tl.add(wipe(path, now), 0)
  const blocks = blocksOf(root)
  if (blocks.length) tl.add(slide(blocks, now), 0)
  const caption = one(root, '[data-caption]')
  if (caption) tl.add(wipe(caption, now), reducedFor(options) ? 0 : MOVES.slide.stagger * blocks.length)
  return tl
}

const lineKeys = (props: CodeBlockProps) => splitLines(props.text, props.start ?? props.lines?.[0] ?? 1).map(l => l.key)

export const codeBlockMotion: PieceMotion<CodeBlockProps> = {
  capture: captureRows,
  enter: (root, _props, options = {}) => arrive(root, options),
  exit(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const out = { ...options, direction: 'out' as const, delay: 0 }
    const reduced = reducedFor(options)
    const caption = one(root, '[data-caption]')
    if (caption) tl.add(wipe(caption, out), 0)
    const blocks = blocksOf(root).reverse()
    const slideAt = caption && !reduced ? MOVES.wipe.out / 2 : 0
    if (blocks.length) tl.add(slide(blocks, out), slideAt)
    const path = one(root, '[data-path]')
    if (path) tl.add(wipe(path, out), reduced ? 0 : slideAt + MOVES.slide.out)
    return tl
  },
  // A push changed the file: new lines slide into place while the lines that stayed move with Flip.
  update: (root, prev, next, options = {}) => (prev.text === next.text ? gsap.timeline() : rowsUpdate(root, lineKeys(prev), options)),
  morph(root, prev, next, options = {}) {
    if (prev.repo === next.repo && prev.path === next.path) return codeBlockMotion.update(root, prev, next, options)
    return arrive(root, options)
  },
}

/** Show all: the hidden lines slide in below at interaction speed, a little apart, however many there are. */
export function revealMotion(targets: HTMLElement[], options: MoveOptions = {}): gsap.core.Timeline {
  const tl = gsap.timeline()
  if (!targets.length) return tl
  if (reducedFor(options)) return fade(targets, 'in')
  const amount = Math.min(MOVES.slide.stagger * (targets.length - 1), INTERACTION.fold)
  tl.fromTo(
    targets,
    { x: -MOVES.slide.distance, opacity: 0 },
    { x: 0, opacity: 1, duration: INTERACTION.fold, ease: EASE.arrive, stagger: { amount }, clearProps: 'transform,opacity' },
  )
  return tl
}
