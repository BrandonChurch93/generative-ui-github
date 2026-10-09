import { gsap } from 'gsap'
import { count, draw, EASE, extend, fade, MOVES, one, prefersReducedMotion, wipe, within, type MoveOptions, type PieceMotion } from '../../motion'
import { BIN_COUNT, binOf, countScale, roundDuration, shortDuration, type DistributionProps } from './schema'

const BAR_STAGGER = 0.04
const P90_LAG = 0.16
// The stem leaves its bar a beat before the bar lands, so the two read as one motion.
const STEM_OVERLAP = 0.1
const CAP_SETTLE = MOVES.pop.duration

const reducedOf = (options: MoveOptions) => options.reduced ?? prefersReducedMotion()
const bars = (root: HTMLElement) => within(root, '[data-bar]')
const maxOf = (props: DistributionProps) => countScale(Math.max(0, ...props.counts)).max

/** Up out of the bar, from the baseline; erases back down into it. */
function stem(node: HTMLElement, direction: 'in' | 'out', options: MoveOptions): gsap.core.Timeline {
  if (reducedOf(options)) return fade(node, direction)
  const tl = gsap.timeline()
  const [from, to] = direction === 'in' ? [0, 1] : [1, 0]
  tl.fromTo(
    node,
    { scaleY: from, transformOrigin: 'center bottom' },
    { scaleY: to, duration: direction === 'in' ? MOVES.draw.in : MOVES.draw.out, ease: direction === 'in' ? MOVES.draw.ease : EASE.exit },
  )
  return tl
}

function cap(node: HTMLElement, direction: 'in' | 'out', options: MoveOptions): gsap.core.Timeline {
  if (reducedOf(options)) return fade(node, direction)
  const tl = gsap.timeline()
  if (direction === 'in') tl.fromTo(node, { scale: 0 }, { scale: 1, duration: CAP_SETTLE, ease: EASE.arrive })
  else tl.fromTo(node, { scale: 1 }, { scale: 0, duration: CAP_SETTLE, ease: EASE.exit })
  return tl
}

/** The median's label value, counted in the unit the new label uses. */
function countMedian(root: HTMLElement, prev: DistributionProps | null, next: DistributionProps, options: MoveOptions, at: number, tl: gsap.core.Timeline) {
  const node = one(root, '[data-marker-value]')
  if (!node) return
  const to = roundDuration(next.medianMinutes)
  const divisor = { min: 1, h: 60, d: 1440 }[to.unit]
  const from = prev ? prev.medianMinutes / divisor : 0
  tl.add(count(node, { ...options, from, to: to.value, format: v => shortDuration({ value: v, unit: to.unit }) }), at)
}

function resize(root: HTMLElement, prev: DistributionProps, next: DistributionProps, options: MoveOptions, tl: gsap.core.Timeline) {
  const [prevMax, nextMax] = [maxOf(prev), maxOf(next)]
  const reduced = reducedOf(options)
  bars(root).forEach((bar, i) => {
    const [a, b] = [((prev.counts[i] ?? 0) / prevMax) * 100, ((next.counts[i] ?? 0) / nextMax) * 100]
    if (a === b) return
    tl.add(reduced ? fade(bar) : gsap.fromTo(bar, { height: `${a}%` }, { height: `${b}%`, duration: MOVES.extend.in, ease: MOVES.extend.ease }), 0)
  })
  const [prevTicks, nextTicks] = [countScale(Math.max(0, ...prev.counts)).ticks.slice(1, -1), countScale(Math.max(0, ...next.counts)).ticks.slice(1, -1)]
  within(root, '[data-tick]').forEach((node, i) => {
    const to = nextTicks[i]
    if (to === undefined || prevTicks[i] === to) return
    tl.add(count(node, { ...options, from: prevTicks[i] ?? 0, to }), 0)
  })
}

/** If the median changed bins, its stem erases into the old bar and draws out of the new one; the number counts either way. */
function remark(root: HTMLElement, prev: DistributionProps, next: DistributionProps, options: MoveOptions, tl: gsap.core.Timeline) {
  const marker = one(root, '[data-marker]')
  const node = one(root, '[data-stem]')
  const [from, to] = [binOf(prev.medianMinutes), binOf(next.medianMinutes)]
  if (marker && node && from !== to && !reducedOf(options)) {
    const left = marker.style.left
    tl.set(marker, { left: `${((from + 0.5) / BIN_COUNT) * 100}%` }, 0)
    tl.add(stem(node, 'out', options), 0)
    tl.set(marker, { left }, MOVES.draw.out)
    tl.add(stem(node, 'in', options), MOVES.draw.out)
  }
  countMedian(root, prev, next, options, 0, tl)
}

function rewrite(root: HTMLElement, prev: DistributionProps, next: DistributionProps, options: MoveOptions = {}) {
  const tl = gsap.timeline({ delay: options.delay ?? 0 })
  resize(root, prev, next, options, tl)
  remark(root, prev, next, options, tl)
  return tl
}

export const distributionMotion: PieceMotion<DistributionProps> = {
  capture(root) {
    return within(root, '[data-bin]').map(bin => bin.getBoundingClientRect().left)
  },
  enter(root, props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const reduced = reducedOf(options)
    const rules = within(root, '[data-baseline], [data-gridline]')
    if (rules.length) tl.add(extend(rules, options), 0)
    bars(root).forEach((bar, i) =>
      tl.add(
        reduced ? fade(bar) : gsap.fromTo(bar, { scaleY: 0 }, { scaleY: 1, duration: MOVES.extend.in, ease: MOVES.extend.ease }),
        i * BAR_STAGGER,
      ),
    )
    const landed = binOf(props.medianMinutes) * BAR_STAGGER + MOVES.extend.in - STEM_OVERLAP
    const stemNode = one(root, '[data-stem]')
    if (stemNode) tl.add(stem(stemNode, 'in', options), landed)
    const capped = landed + MOVES.draw.in - CAP_SETTLE
    const capNode = one(root, '[data-cap]')
    if (capNode) tl.add(cap(capNode, 'in', options), capped)
    const label = one(root, '[data-marker-label]')
    if (label) tl.add(wipe(label, options), capped)
    countMedian(root, null, props, options, capped, tl)
    const p90 = one(root, '[data-p90]')
    const p90Label = one(root, '[data-p90-label]')
    if (p90) tl.add(draw(p90, { ...options, axis: 'y' }), capped)
    if (p90Label) tl.add(wipe(p90Label, options), capped + P90_LAG)
    return tl
  },
  exit(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const out = { ...options, direction: 'out' as const }
    const reduced = reducedOf(options)
    const labels = within(root, '[data-p90-label], [data-marker-label]')
    if (labels.length) tl.add(wipe(labels, out), 0)
    const capNode = one(root, '[data-cap]')
    if (capNode) tl.add(cap(capNode, 'out', options), 0)
    const p90 = one(root, '[data-p90]')
    if (p90) tl.add(draw(p90, { ...out, axis: 'y' }), MOVES.wipe.out / 2)
    const stemNode = one(root, '[data-stem]')
    if (stemNode) tl.add(stem(stemNode, 'out', options), MOVES.wipe.out / 2)
    const retract = MOVES.wipe.out / 2 + MOVES.draw.out
    const all = bars(root)
    all.forEach((bar, i) =>
      tl.add(
        reduced ? fade(bar, 'out') : gsap.to(bar, { scaleY: 0, duration: MOVES.extend.out, ease: EASE.exit }),
        retract + (all.length - 1 - i) * BAR_STAGGER,
      ),
    )
    const rules = within(root, '[data-baseline], [data-gridline]')
    if (rules.length) tl.add(extend(rules, out), retract + (all.length - 1) * BAR_STAGGER)
    return tl
  },
  update: rewrite,
  morph(root, prev, next, options = {}) {
    const tl = rewrite(root, prev, next, options)
    const reduced = reducedOf(options)
    const before = Array.isArray(options.captured) ? (options.captured as number[]) : []
    within(root, '[data-bin]').forEach((bin, i) => {
      const was = before[i]
      if (was === undefined) return
      const dx = was - bin.getBoundingClientRect().left
      if (dx && !reduced) tl.fromTo(bin, { x: dx }, { x: 0, duration: MOVES.extend.in, ease: MOVES.extend.ease, clearProps: 'x' }, 0)
    })
    const words = within(root, '[data-marker-label], [data-source]')
    if (prev.perspective !== next.perspective || prev.showP90 !== next.showP90) tl.add(wipe(words, options), 0)
    const p90 = one(root, '[data-p90]')
    if (p90 && prev.showP90 === false && next.showP90 !== false) tl.add(draw(p90, { ...options, axis: 'y' }), 0)
    return tl
  },
}
