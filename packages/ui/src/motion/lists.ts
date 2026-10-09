import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import { extend, fade, prefersReducedMotion, slide, type MoveOptions } from './primitives'
import { MOVES } from './motion'
import { within } from './types'

gsap.registerPlugin(Flip)

const rowsOf = (root: HTMLElement) => within(root, '[data-row]')
const hairlinesOf = (rows: HTMLElement[]) => rows.map(r => r.querySelector<HTMLElement>('[data-hairline]')).filter(Boolean) as HTMLElement[]

/** Rows slide in from the left 70ms apart, top to bottom, and each hairline extends as its row lands. */
export function rowsEnter(root: HTMLElement, options: MoveOptions = {}): gsap.core.Timeline {
  const tl = gsap.timeline({ delay: options.delay ?? 0 })
  const rows = rowsOf(root)
  if (!rows.length) return tl
  tl.add(slide(rows, options), 0)
  hairlinesOf(rows).forEach((line, i) => tl.add(extend(line, options), i * MOVES.slide.stagger))
  return tl
}

/** The reverse: hairlines retract and rows slide out, top to bottom. */
export function rowsExit(root: HTMLElement, options: MoveOptions = {}): gsap.core.Timeline {
  const tl = gsap.timeline({ delay: options.delay ?? 0 })
  const rows = rowsOf(root)
  if (!rows.length) return tl
  hairlinesOf(rows).forEach((line, i) => tl.add(extend(line, { ...options, direction: 'out' }), i * MOVES.slide.stagger))
  tl.add(slide(rows, { ...options, direction: 'out' }), 0)
  return tl
}

export function captureRows(root: HTMLElement): Flip.FlipState {
  return Flip.getState(rowsOf(root))
}

/** New rows slide into place while the rows that stayed move with Flip. No exits, no rises. */
export function rowsUpdate(
  root: HTMLElement,
  prevIds: readonly string[],
  options: MoveOptions & { captured?: unknown } = {},
): gsap.core.Timeline {
  const tl = gsap.timeline()
  const rows = rowsOf(root)
  const before = new Set(prevIds)
  const arrived = rows.filter(r => !before.has(r.dataset.row ?? ''))
  const reduced = options.reduced ?? prefersReducedMotion()
  if (options.captured && !reduced) {
    tl.add(Flip.from(options.captured as Flip.FlipState, { targets: rows.filter(r => !arrived.includes(r)), duration: MOVES.slide.in, ease: MOVES.slide.ease }), 0)
  }
  if (arrived.length) tl.add(reduced ? fade(arrived) : slide(arrived, options), 0)
  return tl
}
