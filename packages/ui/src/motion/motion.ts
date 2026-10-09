// Every duration and ease in the system, from design-system/motion.md. Seconds, as GSAP takes them.

export const EASE = {
  /** The house curve, cubic-bezier(.25, 1, .5, 1): anything arriving. */
  arrive: 'power3.out',
  /** Anything that travels across itself: wipes, extends. */
  travel: 'power3.inOut',
  draw: 'power2.inOut',
  exit: 'power2.in',
  count: 'power2.out',
  bloom: 'power2.out',
  /** The one point a component marks as the latest or the peak. Never more than one per component. */
  pop: 'back.out(2)',
  /** WarmingUp lanes: a clock, so linear. */
  clock: 'none',
} as const

export const MOVES = {
  wipe: { in: 0.9, out: 0.5, ease: EASE.travel },
  extend: { in: 0.7, out: 0.35, ease: EASE.travel },
  slide: { in: 0.5, out: 0.35, stagger: 0.07, distance: 10, ease: EASE.arrive, exitEase: EASE.exit },
  draw: { in: 1.1, out: 0.5, ease: EASE.draw },
  count: { duration: 0.8, ease: EASE.count },
  bloom: { up: 0.7, down: 0.7, ease: EASE.bloom },
  /** Cards: a 10px rise with opacity. A card never scales. */
  rise: { in: 0.55, out: 0.35, distance: 10, ease: EASE.arrive, exitEase: EASE.exit },
  pop: { duration: 0.24, ease: EASE.pop },
} as const

export type MoveName = 'wipe' | 'extend' | 'slide' | 'draw' | 'count' | 'bloom' | 'rise'

/** Screen choreography offsets, from the Entrance section. */
export const CHOREOGRAPHY = {
  regionStagger: { min: 0.16, max: 0.2 },
  metricStagger: 0.08,
  totalTarget: 2.4,
  answerBy: 1,
} as const

/** Interaction speed: things the reader does, which must answer faster than things the screen does. */
export const INTERACTION = {
  messageWipe: 0.35,
  menu: 0.18,
  fold: 0.35,
  chipChoose: { min: 0.15, max: 0.2, default: 0.18 },
} as const

/** Reduced motion: every move is this opacity change. Counts jump. */
export const REDUCED = { duration: 0.2, ease: 'none' } as const
