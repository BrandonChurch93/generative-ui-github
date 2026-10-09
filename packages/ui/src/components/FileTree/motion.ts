import { gsap } from 'gsap'
import {
  captureRows,
  count,
  EASE,
  fade,
  INTERACTION,
  MOVES,
  one,
  prefersReducedMotion,
  rowsUpdate,
  slide,
  within,
  type MoveOptions,
  type PieceMotion,
} from '../../motion'
import type { FileTreeProps } from './schema'
import { formatWhole } from './tree'

/** Rows after the eighth arrive together, so a long tree never takes seconds to land. */
const STAGGERED = 8

const rowsOf = (root: HTMLElement) => within(root, '[data-row]')

function countFormat(node: HTMLElement): (v: number) => string {
  const sign = node.dataset.sign ?? ''
  return v => `${sign}${formatWhole(Math.round(v))}`
}

/** When a row starts arriving: 70ms apart for the first eight, then all at once. */
const at = (i: number) => Math.min(i, STAGGERED) * MOVES.slide.stagger

function slideRows(rows: HTMLElement[], options: MoveOptions): gsap.core.Timeline {
  const tl = gsap.timeline()
  if (!rows.length) return tl
  tl.add(slide(rows.slice(0, STAGGERED), options), 0)
  for (const row of rows.slice(STAGGERED)) tl.add(slide(row, options), at(STAGGERED))
  return tl
}

/** A guide grows downward from its folder row, the vertical form of extend. */
function guide(node: HTMLElement, options: MoveOptions & { duration?: number; ease?: string }): gsap.core.Timeline {
  const direction = options.direction ?? 'in'
  if (options.reduced ?? prefersReducedMotion()) return fade(node, direction)
  const tl = gsap.timeline()
  const duration = options.duration ?? (direction === 'in' ? MOVES.extend.in : MOVES.extend.out)
  const [from, to] = direction === 'in' ? [0, 1] : [1, 0]
  tl.fromTo(node, { scaleY: from, transformOrigin: 'center top' }, { scaleY: to, duration, ease: options.ease ?? MOVES.extend.ease })
  return tl
}

/** Each guide starts as the first row of its folder starts to arrive. */
function guideTimes(root: HTMLElement, rows: HTMLElement[]): { node: HTMLElement; at: number }[] {
  return within(root, '[data-guide]').map(node => {
    const first = node.parentElement?.querySelector<HTMLElement>('[data-row]')
    const i = first ? rows.indexOf(first) : 0
    return { node, at: at(Math.max(0, i)) }
  })
}

function countsUp(root: HTMLElement, rows: HTMLElement[], from: Record<string, number> | undefined, options: MoveOptions) {
  const tl = gsap.timeline()
  for (const node of within(root, '[data-count]')) {
    const to = Number(node.dataset.value)
    if (!Number.isFinite(to)) continue
    const key = node.dataset.count ?? ''
    const start = from ? (from[key] ?? 0) : 0
    if (from && start === to) continue
    const row = node.closest<HTMLElement>('[data-row]')
    const i = row ? rows.indexOf(row) : -1
    tl.add(count(node, { ...options, from: start, to, format: countFormat(node) }), from ? 0 : at(Math.max(0, i)))
  }
  return tl
}

interface Captured {
  flip: ReturnType<typeof captureRows>
  ids: string[]
  counts: Record<string, number>
}

export const fileTreeMotion: PieceMotion<FileTreeProps> = {
  capture(root): Captured {
    const counts: Record<string, number> = {}
    for (const node of within(root, '[data-count]')) counts[node.dataset.count ?? ''] = Number(node.dataset.value)
    return { flip: captureRows(root), ids: rowsOf(root).map(r => r.dataset.row ?? ''), counts }
  },
  enter(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const rows = rowsOf(root)
    tl.add(slideRows(rows, options), 0)
    for (const g of guideTimes(root, rows)) tl.add(guide(g.node, options), g.at)
    tl.add(countsUp(root, rows, undefined, options), 0)
    return tl
  },
  exit(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const rows = rowsOf(root)
    for (const g of guideTimes(root, rows)) tl.add(guide(g.node, { ...options, direction: 'out' }), g.at)
    tl.add(slideRows(rows, { ...options, direction: 'out' }), 0)
    return tl
  },
  update(root, prev, _next, options = {}) {
    const captured = options.captured as Captured | undefined
    const ids = captured?.ids ?? prev.files.map(f => f.path)
    const tl = rowsUpdate(root, ids, { ...options, captured: captured?.flip })
    tl.add(countsUp(root, rowsOf(root), captured?.counts ?? {}, options), 0)
    return tl
  },
  // The selection capsule moves by Motion's shared layout transition; the rows and counts change as in an update.
  morph: (root, prev, next, options) => fileTreeMotion.update(root, prev, next, options),
}

// Interaction speed: the reader opened or closed a folder (INTERACTION.fold, power3.inOut).

/** A folder opens: its rows slide in from 10px left as the group grows and its guide extends down. */
export function foldOpen(group: HTMLElement, row: HTMLElement | null, options: MoveOptions = {}): gsap.core.Timeline {
  const rows = within(group, '[data-row]')
  const line = one(group, ':scope > [data-guide]')
  const chevron = row ? one(row, '[data-chevron]') : null
  if (options.reduced ?? prefersReducedMotion()) return fade(group, 'in')
  const tl = gsap.timeline()
  const ease = EASE.travel
  const duration = INTERACTION.fold
  tl.fromTo(group, { height: 0, overflow: 'hidden' }, { height: 'auto', duration, ease, clearProps: 'height,overflow' }, 0)
  if (rows.length) tl.fromTo(rows, { x: -MOVES.slide.distance, opacity: 0 }, { x: 0, opacity: 1, duration, ease, clearProps: 'transform,opacity' }, 0)
  if (line) tl.add(guide(line, { ...options, duration, ease }), 0)
  if (chevron) tl.fromTo(chevron, { rotate: -90 }, { rotate: 0, duration, ease, clearProps: 'rotate' }, 0)
  return tl
}

/** The reverse: rows slide out left, the guide retracts up, the group closes, and the folder's counts take over. */
export function foldClose(group: HTMLElement, row: HTMLElement | null, options: MoveOptions = {}): gsap.core.Timeline {
  const rows = within(group, '[data-row]')
  const line = one(group, ':scope > [data-guide]')
  const counts = row ? one(row, '[data-counts]') : null
  const chevron = row ? one(row, '[data-chevron]') : null
  if (options.reduced ?? prefersReducedMotion()) {
    const tl = fade(group, 'out')
    if (counts) tl.add(fade(counts, 'in'), 0)
    return tl
  }
  const tl = gsap.timeline()
  const ease = EASE.travel
  const duration = INTERACTION.fold
  if (rows.length) tl.fromTo(rows, { x: 0, opacity: 1 }, { x: -MOVES.slide.distance, opacity: 0, duration, ease }, 0)
  if (line) tl.add(guide(line, { ...options, direction: 'out', duration, ease }), 0)
  tl.fromTo(group, { height: group.offsetHeight, overflow: 'hidden' }, { height: 0, duration, ease }, 0)
  if (counts) tl.fromTo(counts, { opacity: 0 }, { opacity: 1, duration, ease }, 0)
  // The chevron already points closed; it turns there from open.
  if (chevron) tl.fromTo(chevron, { rotate: 90 }, { rotate: 0, duration, ease, clearProps: 'rotate' }, 0)
  return tl
}
