import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import {
  captureRows,
  count,
  extend,
  fade,
  MOVES,
  one,
  prefersReducedMotion,
  rowsEnter,
  rowsExit,
  rowsUpdate,
  wipe,
  within,
  type MoveOptions,
  type PieceMotion,
} from '../../motion'
import { barShares, deltaFor, formatMagnitude, formatPairValue, verdictFor } from './reading'
import type { ComparisonPair, ComparisonProps } from './schema'

gsap.registerPlugin(Flip)

/** The current bar follows the previous one, so the change plays as a story. */
const CURRENT_LAG = 0.16

interface Captured {
  rows: unknown
  bars: Flip.FlipState
  tones: Record<string, string>
}

const rowsOf = (root: HTMLElement) => within(root, '[data-row]')
const pairOf = (props: ComparisonProps, row: HTMLElement) => props.pairs.find(p => p.measure === row.dataset.row)
const deltaCell = (row: HTMLElement) => one(row, '[data-verdict-word]')?.parentElement ?? null

function countValue(row: HTMLElement, line: 'current' | 'previous', pair: ComparisonPair, from: number, options: MoveOptions) {
  const node = one(row, `[data-value="${line}"]`)
  if (!node) return gsap.timeline()
  return count(node, { ...options, from, to: pair[line], format: v => formatPairValue(v, pair.unit) })
}

function countDelta(row: HTMLElement, pair: ComparisonPair, from: number, options: MoveOptions) {
  const node = one(row, '[data-delta]')
  const delta = deltaFor(pair)
  if (!node || delta.kind === 'zero') return gsap.timeline()
  return count(node, { ...options, from, to: delta.magnitude, format: v => `${delta.sign}${formatMagnitude(v, delta.decimals)}` })
}

/** One row's story: previous bar and value, then current, then the delta counts up and the verdict wipes in. */
function rowEnter(row: HTMLElement, pair: ComparisonPair, options: MoveOptions): gsap.core.Timeline {
  const tl = gsap.timeline()
  const shares = barShares(pair)
  const previous = one(row, '[data-bar="previous"]')
  const current = one(row, '[data-bar="current"]')
  if (previous && shares.previous > 0) tl.add(extend(previous, options), 0)
  tl.add(countValue(row, 'previous', pair, 0, options), 0)
  if (current && shares.current > 0) tl.add(extend(current, options), CURRENT_LAG)
  tl.add(countValue(row, 'current', pair, 0, options), CURRENT_LAG)
  const landed = CURRENT_LAG + MOVES.extend.in
  tl.add(countDelta(row, pair, 0, options), landed)
  const verdict = one(row, '[data-verdict-word]')
  if (verdict) tl.add(wipe(verdict, options), landed)
  return tl
}

function rowExit(row: HTMLElement, options: MoveOptions): gsap.core.Timeline {
  const tl = gsap.timeline()
  const out = { ...options, direction: 'out' as const }
  const verdict = one(row, '[data-verdict-word]')
  if (verdict) tl.add(wipe(verdict, out), 0)
  const current = one(row, '[data-bar="current"]')
  const previous = one(row, '[data-bar="previous"]')
  if (current) tl.add(extend(current, out), 0)
  if (previous) tl.add(extend(previous, out), CURRENT_LAG)
  return tl
}

/** Bars run from their old length to the new one (both at once on a rescale), values and delta count, the verdict rewipes. */
function rowChange(row: HTMLElement, prev: ComparisonPair, next: ComparisonPair, tone: string | undefined, options: MoveOptions & { stepped?: boolean }) {
  const tl = gsap.timeline()
  const reduced = options.reduced ?? prefersReducedMotion()
  const [before, after] = [barShares(prev), barShares(next)]
  for (const line of ['current', 'previous'] as const) {
    const bar = one(row, `[data-bar="${line}"]`)
    if (!bar || (options.stepped && line === 'previous')) continue
    if (options.stepped) {
      if (after.current > 0) tl.add(extend(bar, options), CURRENT_LAG)
      continue
    }
    if (after[line] === 0 || before[line] === after[line]) continue
    tl.add(
      reduced ? fade(bar) : gsap.fromTo(bar, { scaleX: before[line] / after[line], transformOrigin: 'left center' }, { scaleX: 1, duration: MOVES.extend.in, ease: MOVES.extend.ease }),
      0,
    )
  }
  tl.add(countValue(row, 'current', next, options.stepped ? 0 : prev.current, options), options.stepped ? CURRENT_LAG : 0)
  if (!options.stepped) tl.add(countValue(row, 'previous', next, prev.previous, options), 0)
  const [d0, d1] = [deltaFor(prev), deltaFor(next)]
  const sameWay = d0.sign === d1.sign && d0.kind === d1.kind
  tl.add(countDelta(row, next, sameWay ? d0.magnitude : 0, options), options.stepped ? CURRENT_LAG + MOVES.extend.in : 0)
  const verdict = one(row, '[data-verdict-word]')
  if (verdict && verdictFor(prev) !== verdictFor(next)) {
    tl.add(wipe(verdict, options), 0)
    const cell = deltaCell(row)
    if (cell && tone && !reduced) tl.add(gsap.from(cell, { color: tone, duration: MOVES.count.duration / 2, ease: MOVES.count.ease, clearProps: 'color' }), 0)
  }
  return tl
}

function change(root: HTMLElement, prev: ComparisonProps, next: ComparisonProps, options: MoveOptions & { captured?: unknown } = {}, allowStep = false) {
  const captured = options.captured as Captured | undefined
  const tl = gsap.timeline()
  const reduced = options.reduced ?? prefersReducedMotion()
  const stepped = allowStep && next.periods.previous === prev.periods.current
  tl.add(rowsUpdate(root, prev.pairs.map(p => p.measure), { ...options, captured: captured?.rows }), 0)
  if (stepped && captured && !reduced) {
    // Last period's current bar keeps its flip id, so it travels to line 2 and recolors to data-ref.
    tl.add(Flip.from(captured.bars, { targets: within(root, '[data-bar="previous"]'), props: 'backgroundColor', duration: MOVES.extend.in, ease: MOVES.extend.ease }), 0)
  }
  for (const row of rowsOf(root)) {
    const after = pairOf(next, row)
    if (!after) continue
    const before = pairOf(prev, row)
    if (!before) {
      tl.add(rowEnter(row, after, options), 0)
      continue
    }
    tl.add(rowChange(row, before, after, captured?.tones[after.measure], { ...options, stepped }), 0)
  }
  return tl
}

export const comparisonMotion: PieceMotion<ComparisonProps> = {
  capture(root): Captured {
    return {
      rows: captureRows(root),
      bars: Flip.getState(within(root, '[data-flip-id]'), { props: 'backgroundColor' }),
      tones: Object.fromEntries(
        rowsOf(root).flatMap(row => {
          const cell = deltaCell(row)
          return cell ? [[row.dataset.row ?? '', getComputedStyle(cell).color]] : []
        }),
      ),
    }
  },
  enter(root, props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    tl.add(rowsEnter(root, options), 0)
    rowsOf(root).forEach((row, i) => {
      const pair = pairOf(props, row)
      if (pair) tl.add(rowEnter(row, pair, options), i * MOVES.slide.stagger)
    })
    return tl
  },
  exit(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    rowsOf(root).forEach(row => tl.add(rowExit(row, options), 0))
    tl.add(rowsExit(root, options), CURRENT_LAG + MOVES.extend.out)
    return tl
  },
  update: (root, prev, next, options) => change(root, prev, next, options),
  morph: (root, prev, next, options) => change(root, prev, next, options, true),
}
