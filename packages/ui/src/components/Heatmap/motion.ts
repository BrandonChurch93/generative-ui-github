import { gsap } from 'gsap'
import { count, EASE, extend, fade, MOVES, one, pop, prefersReducedMotion, wipe, within, type MoveOptions, type PieceMotion } from '../../motion'
import { HOURS, peakCells, peakOf, stepOf, type Cell } from './heat'
import type { HeatmapProps } from './schema'

const MORPH_COLUMN_STAGGER = 0.02

const reducedFor = (options: MoveOptions) => options.reduced ?? prefersReducedMotion()

/** When the enter wipe's leading edge passes the middle of an hour's column, read off the wipe's own ease. */
function wipeReaches(hour: number): number {
  const ease = gsap.parseEase(MOVES.wipe.ease)
  const target = (hour + 0.5) / HOURS
  let [lo, hi] = [0, 1]
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    if (ease(mid) < target) lo = mid
    else hi = mid
  }
  return hi * MOVES.wipe.in
}

function shrink(targets: Element | Element[], options: MoveOptions) {
  if (reducedFor(options)) return fade(targets, 'out')
  return gsap.timeline().to(targets, { scale: 0, transformOrigin: 'center', duration: MOVES.pop.duration, ease: EASE.exit })
}

const heatColor = (root: HTMLElement, step: number) => getComputedStyle(root).getPropertyValue(`--heat-${step}`).trim()
const cellAt = (root: HTMLElement, { day, hour }: Cell) => one(root, `[data-row="${day}"] [data-hour="${hour}"]`)

/**
 * Re-emphasize, never redraw: changed cells tween to their new step, the legend's high count counts, and a
 * peak that moved shrinks out of its old cell and pops into the new one.
 */
function restep(root: HTMLElement, prev: HeatmapProps, next: HeatmapProps, options: MoveOptions, stagger: number) {
  const tl = gsap.timeline({ delay: options.delay ?? 0 })
  const reduced = reducedFor(options)
  const [prevPeak, nextPeak] = [peakOf(prev.counts), peakOf(next.counts)]
  within(root, '[data-cell]').forEach(cell => {
    const day = Number(cell.closest<HTMLElement>('[data-row]')?.dataset.row)
    const hour = Number(cell.dataset.hour)
    const [from, to] = [stepOf(prev.counts[day]?.[hour] ?? 0, prevPeak), stepOf(next.counts[day]?.[hour] ?? 0, nextPeak)]
    if (from === to) return
    tl.add(
      reduced
        ? fade(cell)
        : gsap.fromTo(
            cell,
            { backgroundColor: heatColor(root, from) },
            { backgroundColor: heatColor(root, to), duration: MOVES.count.duration, ease: MOVES.count.ease, clearProps: 'backgroundColor' },
          ),
      hour * stagger,
    )
  })

  const high = one(root, '[data-legend-high]')
  if (high && prevPeak !== nextPeak) tl.add(count(high, { ...options, from: prevPeak, to: nextPeak }), 0)

  const key = (c: Cell) => `${c.day}-${c.hour}`
  const before = new Set(peakCells(prev.counts).map(key))
  const after = peakCells(next.counts)
  const afterKeys = new Set(after.map(key))
  const template = one(root, '[data-peak-dot]')
  peakCells(prev.counts)
    .filter(c => !afterKeys.has(key(c)))
    .forEach(c => {
      // The old cell's dot is gone from the DOM by now; a stand-in shrinks out where it was.
      const cell = cellAt(root, c)
      if (!cell || !template) return
      const ghost = template.cloneNode() as HTMLElement
      cell.append(ghost)
      tl.add(shrink(ghost, options).eventCallback('onComplete', () => ghost.remove()), 0)
    })
  after
    .filter(c => !before.has(key(c)))
    .forEach(c => {
      const dot = cellAt(root, c)?.querySelector('[data-peak-dot]')
      if (dot) tl.add(pop(dot, options), MOVES.pop.duration)
    })
  return tl
}

export const heatmapMotion: PieceMotion<HeatmapProps> = {
  enter(root, props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    // Reduced, the dot and the legend appear with the grid.
    const at = (t: number) => (reducedFor(options) ? 0 : t)
    const heat = one(root, '[data-heat]')
    if (heat) tl.add(wipe(heat, options), 0)
    // The one bounce: the peak dot lands as the wipe passes its column. Zero cells ride with the layer.
    for (const peak of peakCells(props.counts)) {
      const dot = cellAt(root, peak)?.querySelector('[data-peak-dot]')
      if (dot) tl.add(pop(dot, options), at(wipeReaches(peak.hour)))
    }
    const legendAt = MOVES.wipe.in / 2
    tl.add(extend(within(root, '[data-swatches]'), options), at(legendAt))
    const peakLine = one(root, '[data-peak-line]')
    if (peakLine) tl.add(wipe(peakLine, options), at(legendAt + MOVES.extend.in))
    return tl
  },
  exit(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const out = { ...options, direction: 'out' as const }
    const at = (t: number) => (reducedFor(options) ? 0 : t)
    const peakLine = one(root, '[data-peak-line]')
    if (peakLine) tl.add(wipe(peakLine, out), 0)
    const legendAt = MOVES.wipe.out / 2
    tl.add(extend(within(root, '[data-swatches]'), out), at(legendAt))
    const dots = within(root, '[data-peak-dot]')
    const dotsAt = legendAt + MOVES.extend.out
    if (dots.length) tl.add(shrink(dots, options), at(dotsAt))
    const heat = one(root, '[data-heat]')
    if (heat) {
      tl.add(
        reducedFor(options)
          ? fade(heat, 'out')
          : gsap.fromTo(
              heat,
              { clipPath: 'inset(0% 0% 0% 0%)' },
              { clipPath: 'inset(0% 0% 0% 100%)', duration: MOVES.wipe.out, ease: EASE.exit },
            ),
        at(dotsAt),
      )
    }
    return tl
  },
  update(root, prev, next, options = {}) {
    return restep(root, prev, next, options, 0)
  },
  morph(root, prev, next, options = {}) {
    const tl = restep(root, prev, next, options, MORPH_COLUMN_STAGGER)
    // The words changed with the commit; they wipe in fresh while the cells re-step.
    const words = within(root, '[data-card-head] h2, [data-card-head] span')
    if (words.length && (prev.title !== next.title || prev.window !== next.window || prev.unit !== next.unit)) {
      tl.add(wipe(words, { ...options, delay: 0 }), 0)
    }
    return tl
  },
}
