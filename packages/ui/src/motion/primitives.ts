import { gsap } from 'gsap'
import { MOVES, REDUCED } from './motion'

export type Direction = 'in' | 'out'
type Targets = Element | Element[]

export interface MoveOptions {
  direction?: Direction
  /** Overrides the media query; the catalog and tests use it. */
  reduced?: boolean
  delay?: number
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}

const isReduced = (options: MoveOptions) => options.reduced ?? prefersReducedMotion()
const list = (targets: Targets): Element[] => (Array.isArray(targets) ? targets : [targets])

/** The reduced branch every move collapses to: a 200ms opacity change, order and offsets kept. */
export function fade(targets: Targets, direction: Direction = 'in', stagger = 0): gsap.core.Timeline {
  const tl = gsap.timeline()
  const [from, to] = direction === 'in' ? [0, 1] : [1, 0]
  tl.fromTo(list(targets), { opacity: from }, { opacity: to, duration: REDUCED.duration, ease: REDUCED.ease, stagger })
  return tl
}

function timeline(options: MoveOptions): gsap.core.Timeline {
  return gsap.timeline({ delay: options.delay ?? 0 })
}

/** Reveals text left to right behind a clip; exits the same direction, like a line being retyped. */
export function wipe(targets: Targets, options: MoveOptions = {}): gsap.core.Timeline {
  const direction = options.direction ?? 'in'
  if (isReduced(options)) return fade(targets, direction)
  const tl = timeline(options)
  if (direction === 'in') {
    tl.fromTo(
      list(targets),
      { clipPath: 'inset(0% 100% 0% 0%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: MOVES.wipe.in, ease: MOVES.wipe.ease },
    )
  } else {
    tl.fromTo(
      list(targets),
      { clipPath: 'inset(0% 0% 0% 0%)' },
      { clipPath: 'inset(0% 0% 0% 100%)', duration: MOVES.wipe.out, ease: MOVES.wipe.ease },
    )
  }
  return tl
}

/** A bar or hairline grows from its left end; retracts to the left on exit. `to` is the final fraction (0 to 1). */
export function extend(targets: Targets, options: MoveOptions & { from?: number; to?: number } = {}): gsap.core.Timeline {
  const direction = options.direction ?? 'in'
  if (isReduced(options)) {
    gsap.set(list(targets), { scaleX: direction === 'in' ? (options.to ?? 1) : 0, transformOrigin: 'left center' })
    return fade(targets, direction)
  }
  const tl = timeline(options)
  const [from, to, duration] =
    direction === 'in' ? [options.from ?? 0, options.to ?? 1, MOVES.extend.in] : [options.from ?? 1, 0, MOVES.extend.out]
  tl.fromTo(
    list(targets),
    { scaleX: from, transformOrigin: 'left center' },
    { scaleX: to, duration, ease: MOVES.extend.ease },
  )
  return tl
}

/** Rows arrive from 10px left with opacity, 70ms apart, top to bottom; they leave the same way. */
export function slide(targets: Targets, options: MoveOptions = {}): gsap.core.Timeline {
  const direction = options.direction ?? 'in'
  const { stagger, distance } = MOVES.slide
  if (isReduced(options)) return fade(targets, direction, stagger)
  const tl = timeline(options)
  if (direction === 'in') {
    tl.fromTo(
      list(targets),
      { x: -distance, opacity: 0 },
      { x: 0, opacity: 1, duration: MOVES.slide.in, ease: MOVES.slide.ease, stagger },
    )
  } else {
    tl.fromTo(
      list(targets),
      { x: 0, opacity: 1 },
      { x: -distance, opacity: 0, duration: MOVES.slide.out, ease: MOVES.slide.exitEase, stagger },
    )
  }
  return tl
}

function pathLength(node: Element): number | undefined {
  const geometry = node as SVGGeometryElement
  return typeof geometry.getTotalLength === 'function' ? geometry.getTotalLength() : undefined
}

/**
 * A path draws along its length and erases back on exit. A box (the insight rule) draws along `axis`.
 */
export function draw(targets: Targets, options: MoveOptions & { axis?: 'x' | 'y' } = {}): gsap.core.Timeline {
  const direction = options.direction ?? 'in'
  if (isReduced(options)) return fade(targets, direction)
  const tl = timeline(options)
  const duration = direction === 'in' ? MOVES.draw.in : MOVES.draw.out
  for (const node of list(targets)) {
    const length = pathLength(node)
    if (length !== undefined) {
      const [from, to] = direction === 'in' ? [length, 0] : [0, length]
      tl.fromTo(
        node,
        { strokeDasharray: length, strokeDashoffset: from },
        { strokeDashoffset: to, duration, ease: MOVES.draw.ease },
        0,
      )
    } else {
      const axis = options.axis ?? 'y'
      const prop = axis === 'y' ? 'scaleY' : 'scaleX'
      const origin = axis === 'y' ? 'center top' : 'left center'
      const [from, to] = direction === 'in' ? [0, 1] : [1, 0]
      tl.fromTo(node, { [prop]: from, transformOrigin: origin }, { [prop]: to, duration, ease: MOVES.draw.ease }, 0)
    }
  }
  return tl
}

const oneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

export function formatCount(value: number, decimals: 0 | 1): string {
  return decimals === 0 ? Math.round(value).toLocaleString('en-US') : oneDecimal.format(Math.round(value * 10) / 10)
}

/** A number runs from its previous value to the new one, one decimal at most. Reduced, it jumps. */
export function count(
  node: Element,
  options: MoveOptions & { from?: number; to: number; format?: (value: number) => string },
): gsap.core.Timeline {
  const decimals: 0 | 1 = Number.isInteger(options.to) && Number.isInteger(options.from ?? 0) ? 0 : 1
  const format = options.format ?? ((v: number) => formatCount(v, decimals))
  if (isReduced(options)) {
    node.textContent = format(options.to)
    return fade(node, 'in')
  }
  const tl = timeline(options)
  const state = { value: options.from ?? 0 }
  node.textContent = format(state.value)
  tl.to(state, {
    value: options.to,
    duration: MOVES.count.duration,
    ease: MOVES.count.ease,
    onUpdate: () => {
      node.textContent = format(state.value)
    },
  })
  return tl
}

/** Warmth rises behind a piece and settles back. `node` is the piece's bloom layer, which carries the `bloom` shadow. */
export function bloom(node: Element, options: MoveOptions = {}): gsap.core.Timeline {
  if (isReduced(options)) return fade(node, 'out')
  const tl = timeline(options)
  tl.fromTo(node, { opacity: 0 }, { opacity: 1, duration: MOVES.bloom.up, ease: MOVES.bloom.ease })
  tl.to(node, { opacity: 0, duration: MOVES.bloom.down, ease: MOVES.bloom.ease })
  return tl
}

/** A card arrives with a 10px rise and opacity, and sinks back the same way. It never scales. */
export function rise(targets: Targets, options: MoveOptions = {}): gsap.core.Timeline {
  const direction = options.direction ?? 'in'
  if (isReduced(options)) return fade(targets, direction)
  const tl = timeline(options)
  const { distance } = MOVES.rise
  if (direction === 'in') {
    tl.fromTo(list(targets), { y: distance, opacity: 0 }, { y: 0, opacity: 1, duration: MOVES.rise.in, ease: MOVES.rise.ease })
  } else {
    tl.fromTo(
      list(targets),
      { y: 0, opacity: 1 },
      { y: distance, opacity: 0, duration: MOVES.rise.out, ease: MOVES.rise.exitEase },
    )
  }
  return tl
}

/** The latest point lands: the one bounce a component is allowed. */
export function pop(node: Element, options: MoveOptions = {}): gsap.core.Timeline {
  if (isReduced(options)) return fade(node, options.direction ?? 'in')
  const tl = timeline(options)
  tl.fromTo(node, { scale: 0, transformOrigin: 'center' }, { scale: 1, duration: MOVES.pop.duration, ease: MOVES.pop.ease })
  return tl
}

/** Motion (Framer) variants for the card wrapper, which Motion owns. Same values as `rise`. */
export const riseVariants = {
  hidden: { opacity: 0, y: MOVES.rise.distance },
  shown: { opacity: 1, y: 0, transition: { duration: MOVES.rise.in, ease: [0.25, 1, 0.5, 1] as const } },
  gone: { opacity: 0, y: MOVES.rise.distance, transition: { duration: MOVES.rise.out, ease: [0.55, 0.085, 0.68, 0.53] as const } },
}
