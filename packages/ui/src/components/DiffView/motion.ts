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
  wipe,
  within,
  type Direction,
  type MoveOptions,
  type PieceMotion,
} from '../../motion'
import { parsePatch } from './patch'
import { formatCount, type DiffViewProps } from './schema'

const reducedFor = (options: MoveOptions) => options.reduced ?? prefersReducedMotion()

/** Hunks land as whole blocks, so a long file still arrives in under a second; then the fold row or the one message row. */
const blocksOf = (root: HTMLElement) => within(root, '[data-hunk], [data-fold], [data-message], [data-state-row]')

/**
 * The extend move on a line's tint. The tint is the row's background, drawn to `--tint` of its width,
 * so it can grow from the card's left edge behind numbers and code alike without moving the text.
 */
function tint(rows: HTMLElement[], options: MoveOptions): gsap.core.Timeline {
  const tl = gsap.timeline()
  if (!rows.length || reducedFor(options)) return tl
  const direction = options.direction ?? 'in'
  const [from, to, duration] = direction === 'in' ? [0, 1, MOVES.extend.in] : [1, 0, MOVES.extend.out]
  tl.fromTo(rows, { '--tint': from }, { '--tint': to, duration, ease: MOVES.extend.ease })
  return tl
}

function counts(root: HTMLElement, prev: DiffViewProps | undefined, next: DiffViewProps, options: MoveOptions): gsap.core.Timeline {
  const tl = gsap.timeline()
  const add = one(root, '[data-count="add"]')
  const del = one(root, '[data-count="del"]')
  const fmt = (sign: string) => (v: number) => `${sign}${formatCount(Math.round(v))}`
  if (add && prev?.additions !== next.additions) tl.add(count(add, { ...options, from: prev?.additions ?? 0, to: next.additions, format: fmt('+') }), 0)
  if (del && prev?.deletions !== next.deletions) tl.add(count(del, { ...options, from: prev?.deletions ?? 0, to: next.deletions, format: fmt('−') }), 0)
  return tl
}

function arrive(root: HTMLElement, prev: DiffViewProps | undefined, next: DiffViewProps, options: MoveOptions): gsap.core.Timeline {
  const tl = gsap.timeline({ delay: options.delay ?? 0 })
  const path = one(root, '[data-path]')
  if (path) tl.add(wipe(path, { ...options, delay: 0 }), 0)
  const blocks = blocksOf(root)
  if (blocks.length) tl.add(slide(blocks, { ...options, delay: 0 }), 0)
  within(root, '[data-hunk]').forEach((hunk, i) => {
    tl.add(tint(within(hunk, '[data-tint]'), { ...options, delay: 0 }), i * MOVES.slide.stagger)
  })
  tl.add(counts(root, prev, next, { ...options, delay: 0 }), 0)
  return tl
}

const lineKeys = (props: DiffViewProps) => parsePatch(props.patch).flatMap(h => h.lines.map(l => l.key))

export const diffViewMotion: PieceMotion<DiffViewProps> = {
  capture: captureRows,
  enter: (root, props, options = {}) => arrive(root, undefined, props, options),
  exit(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const out = { ...options, direction: 'out' as const, delay: 0 }
    tl.add(tint(within(root, '[data-tint]'), out), 0)
    const blocks = blocksOf(root)
    const slideAt = reducedFor(options) ? 0 : MOVES.extend.out / 2
    if (blocks.length) tl.add(slide(blocks, out), slideAt)
    const path = one(root, '[data-path]')
    if (path) tl.add(wipe(path, out), reducedFor(options) ? 0 : slideAt + MOVES.slide.out)
    return tl
  },
  update(root, prev, next, options = {}) {
    const tl = rowsUpdate(root, lineKeys(prev), options)
    tl.add(counts(root, prev, next, options), 0)
    return tl
  },
  morph(root, prev, next, options = {}) {
    if (prev.path === next.path && prev.repo === next.repo && prev.pr === next.pr) {
      // The same file survived the rewrite: nothing replays unless a push changed it.
      return prev.patch === next.patch ? gsap.timeline() : diffViewMotion.update(root, prev, next, options)
    }
    return arrive(root, prev, next, options)
  },
}

/** The reader folds or opens the file: the body's height moves at interaction speed while the chevron turns. */
export function foldMotion(
  body: HTMLElement | null,
  chevron: Element | null,
  direction: Direction,
  options: MoveOptions = {},
): gsap.core.Timeline {
  const tl = gsap.timeline()
  if (reducedFor(options)) {
    if (body) tl.add(fade(body, direction), 0)
    return tl
  }
  const [from, to] = direction === 'in' ? [0, 90] : [90, 0]
  if (chevron) tl.fromTo(chevron, { rotation: from }, { rotation: to, duration: INTERACTION.fold, ease: EASE.travel, clearProps: 'transform' }, 0)
  if (body) {
    const height = direction === 'in' ? 'auto' : 0
    // A fold reversed midway starts from the height it reached, not from zero.
    const start = body.style.height ? body.offsetHeight : direction === 'in' ? 0 : body.offsetHeight
    tl.fromTo(
      body,
      { height: start, overflow: 'hidden' },
      { height, duration: INTERACTION.fold, ease: EASE.travel, ...(direction === 'in' ? { clearProps: 'height,overflow' } : {}) },
      0,
    )
  }
  return tl
}

/** Show all: the hidden hunks slide in below at interaction speed, a little apart, however many there are. */
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
