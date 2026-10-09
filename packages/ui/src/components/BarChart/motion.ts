import { gsap } from 'gsap'
import { formatChartValue } from '../../charts/scale'
import { count, EASE, extend, fade, MOVES, one, prefersReducedMotion, within, type MoveOptions, type PieceMotion } from '../../motion'
import { barHeight, barScale, barsOf } from './BarChart'
import type { BarChartProps } from './schema'

/** The same 40ms as LineChart's failure columns, so bars on one screen grow at one rhythm. */
const BAR_STAGGER = 0.04

const heights = (props: BarChartProps) => {
  const { max } = barScale(props)
  return new Map(barsOf(props).map(b => [b.key, { height: barHeight(b.value, max), value: b.value }]))
}

/**
 * Bars grow by height rather than scaleY so the value riding on each cap moves with it instead of
 * squashing; the motion is still extend's: its duration, its ease, from the baseline.
 */
function grow(bar: HTMLElement, from: number, to: number, duration: number, ease: string) {
  return gsap.fromTo(bar, { height: `${from}%` }, { height: `${to}%`, duration, ease })
}

function regrow(root: HTMLElement, prev: BarChartProps, next: BarChartProps, options: MoveOptions = {}) {
  const tl = gsap.timeline()
  const bars = within(root, '[data-bar]')
  if (options.reduced ?? prefersReducedMotion()) return bars.length ? fade(bars) : tl
  const [before, after] = [heights(prev), heights(next)]
  bars.forEach(bar => {
    const key = bar.dataset.bar ?? ''
    const now = after.get(key)
    if (!now) return
    const was = before.get(key)
    tl.add(grow(bar, was?.height ?? 0, now.height, MOVES.extend.in, MOVES.extend.ease), 0)
    const value = one(bar, '[data-value]')
    if (value && was?.value !== now.value) {
      tl.add(count(value, { ...options, delay: 0, from: was?.value ?? 0, to: now.value, format: v => formatChartValue(v, next.unit) }), 0)
    }
  })
  return tl
}

export const barChartMotion: PieceMotion<BarChartProps> = {
  enter(root, props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const inner = { ...options, delay: 0 }
    const reduced = options.reduced ?? prefersReducedMotion()
    const baseline = one(root, '[data-baseline]')
    if (baseline) tl.add(extend(baseline, inner), 0)
    const target = heights(props)
    within(root, '[data-bar]').forEach((bar, i) => {
      const at = i * BAR_STAGGER
      const datum = target.get(bar.dataset.bar ?? '')
      if (!datum) return
      tl.add(reduced ? fade(bar) : grow(bar, 0, datum.height, MOVES.extend.in, MOVES.extend.ease), at)
      const value = one(bar, '[data-value]')
      if (value) tl.add(count(value, { ...inner, from: 0, to: datum.value, format: v => formatChartValue(v, props.unit) }), at)
    })
    return tl
  },
  exit(root, props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const out = { ...options, delay: 0, direction: 'out' as const }
    const reduced = options.reduced ?? prefersReducedMotion()
    const values = within(root, '[data-value]')
    if (values.length) tl.add(fade(values, 'out'), 0)
    const target = heights(props)
    const bars = within(root, '[data-bar]').reverse()
    bars.forEach((bar, i) => {
      const datum = target.get(bar.dataset.bar ?? '')
      tl.add(reduced ? fade(bar, 'out') : grow(bar, datum?.height ?? 0, 0, MOVES.extend.out, EASE.exit), i * BAR_STAGGER)
    })
    // The baseline came first, so it leaves last.
    const baseline = one(root, '[data-baseline]')
    if (baseline) tl.add(extend(baseline, out), bars.length * BAR_STAGGER)
    return tl
  },
  update: regrow,
  morph: regrow,
}
