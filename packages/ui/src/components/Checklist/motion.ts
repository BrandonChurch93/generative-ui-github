import { gsap } from 'gsap'
import { captureRows, count, fade, MOVES, one, prefersReducedMotion, rowsEnter, rowsExit, rowsUpdate, type MoveOptions, type PieceMotion } from '../../motion'
import { tally } from './Checklist'
import type { ChecklistProps } from './schema'

/** The arc draws round from twelve o'clock to the share passed, on draw's timing; it erases back the same way. */
function arc(ring: HTMLElement, from: number, to: number, duration: number, ease: string) {
  return gsap.fromTo(ring, { '--share': from }, { '--share': to, duration, ease })
}

function summaryEnter(root: HTMLElement, props: ChecklistProps, options: MoveOptions, tl: gsap.core.Timeline) {
  const { passed, share } = tally(props.items)
  const reduced = options.reduced ?? prefersReducedMotion()
  const ring = one(root, '[data-ring]')
  if (ring) tl.add(reduced ? fade(ring) : arc(ring, 0, share, MOVES.draw.in, MOVES.draw.ease), 0)
  const number = one(root, '[data-number]')
  if (number) tl.add(count(number, { ...options, from: 0, to: passed }), 0)
}

function retally(root: HTMLElement, prev: ChecklistProps, next: ChecklistProps, options: MoveOptions & { captured?: unknown } = {}) {
  const tl = gsap.timeline()
  const [before, after] = [tally(prev.items), tally(next.items)]
  const reduced = options.reduced ?? prefersReducedMotion()
  const ring = one(root, '[data-ring]')
  if (ring && before.share !== after.share) {
    tl.add(reduced ? fade(ring) : arc(ring, before.share, after.share, MOVES.count.duration, MOVES.count.ease), 0)
  }
  const number = one(root, '[data-number]')
  if (number && before.passed !== after.passed) tl.add(count(number, { ...options, delay: 0, from: before.passed, to: after.passed }), 0)
  tl.add(rowsUpdate(root, prev.items.map(i => i.id), options), 0)
  return tl
}

export const checklistMotion: PieceMotion<ChecklistProps> = {
  capture: captureRows,
  enter(root, props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const inner = { ...options, delay: 0 }
    summaryEnter(root, props, inner, tl)
    tl.add(rowsEnter(root, inner), 0)
    return tl
  },
  exit(root, props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const out = { ...options, delay: 0, direction: 'out' as const }
    tl.add(rowsExit(root, out), 0)
    const ring = one(root, '[data-ring]')
    if (ring) {
      tl.add(
        (options.reduced ?? prefersReducedMotion()) ? fade(ring, 'out') : arc(ring, tally(props.items).share, 0, MOVES.draw.out, MOVES.draw.ease),
        0,
      )
    }
    return tl
  },
  update: retally,
  morph: retally,
}
