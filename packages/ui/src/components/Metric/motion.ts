import { gsap } from 'gsap'
import { count, extend, fade, MOVES, one, prefersReducedMotion, wipe, type MoveOptions, type PieceMotion } from '../../motion'
import { sparklineMotion } from '../Sparkline/motion'
import { formatMetricValue } from './Metric'
import type { MetricProps } from './schema'

/** Counts with the component's own formatter, so the last frame matches what React rendered. */
function countTo(root: HTMLElement, from: number | string | undefined, to: number | string, options: MoveOptions) {
  const number = one(root, '[data-number]')
  if (!number) return gsap.timeline()
  if (typeof to !== 'number') return wipe(number, options)
  const decimals = Number.isInteger(to) && (typeof from !== 'number' || Number.isInteger(from)) ? 0 : 1
  return count(number, {
    ...options,
    from: typeof from === 'number' ? from : 0,
    to,
    format: v => (decimals === 0 ? formatMetricValue(Math.round(v)) : formatMetricValue(Math.round(v * 10) / 10)),
  })
}

function sparkProps(props: MetricProps) {
  return { points: props.series?.points ?? [] }
}

export const metricMotion: PieceMotion<MetricProps> = {
  enter(root, props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const bar = one(root, '[data-bar]')
    if (bar) tl.add(extend(bar, options), 0)
    tl.add(countTo(root, 0, props.value, options), 0)
    if (one(root, '[data-spark]')) tl.add(sparklineMotion.enter(root, sparkProps(props), options), 0)
    return tl
  },
  exit(root, props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const bar = one(root, '[data-bar]')
    if (bar) tl.add(extend(bar, { ...options, direction: 'out' }), 0)
    if (one(root, '[data-spark]')) tl.add(sparklineMotion.exit(root, sparkProps(props), options), 0)
    return tl
  },
  update(root, prev, next, options = {}) {
    const tl = gsap.timeline()
    tl.add(countTo(root, prev.value, next.value, options), 0)
    if (one(root, '[data-spark]')) tl.add(sparklineMotion.update(root, sparkProps(prev), sparkProps(next), options), 0)
    return tl
  },
  morph(root, prev, next, options = {}) {
    const tl = metricMotion.update(root, prev, next, options)
    const delta = one(root, '[data-delta]')
    if (delta && prev.delta !== next.delta) {
      const reduced = options.reduced ?? prefersReducedMotion()
      tl.add(reduced ? fade(delta) : gsap.fromTo(delta, { opacity: 0 }, { opacity: 1, duration: MOVES.count.duration / 2, ease: MOVES.count.ease }), 0)
    }
    return tl
  },
}
