import { gsap } from 'gsap'
import { formatChartValue, linePath, niceScale, yPercent } from '../../charts/scale'
import { count, draw, EASE, extend, fade, MOVES, one, pop, prefersReducedMotion, within, type MoveOptions, type PieceMotion } from '../../motion'
import type { LineChartProps } from './schema'

const COLUMN_STAGGER = 0.04
const SECOND_SERIES_LAG = 0.12

const maxOf = (props: LineChartProps) => niceScale(Math.max(0, ...props.series.flatMap(s => s.points.filter((p): p is number => p !== null)))).max
const lastValue = (points: (number | null)[]) => [...points].reverse().find((p): p is number => p !== null)

function countEnds(root: HTMLElement, prev: LineChartProps | null, next: LineChartProps, options: MoveOptions, at: number, tl: gsap.core.Timeline) {
  within(root, '[data-end-value]').forEach((node, i) => {
    const to = lastValue(next.series[i]?.points ?? [])
    if (to === undefined) return
    const from = prev ? (lastValue(prev.series[i]?.points ?? []) ?? 0) : 0
    tl.add(count(node, { ...options, from, to, format: v => formatChartValue(v, next.unit) }), at)
  })
}

function retrace(root: HTMLElement, prev: LineChartProps, next: LineChartProps, options: MoveOptions = {}) {
  const tl = gsap.timeline()
  if (options.reduced ?? prefersReducedMotion()) return fade(within(root, '[data-line], [data-endpoint], [data-end-label]'))
  const { duration, ease } = MOVES.count
  const [prevMax, nextMax] = [maxOf(prev), maxOf(next)]
  within(root, '[data-line]').forEach(path => {
    const si = Number(path.getAttribute('data-series'))
    const before = prev.series[si]
    const after = next.series[si]
    if (!before || !after || before.points.length !== after.points.length) return
    tl.fromTo(path, { attr: { d: linePath(before.points, prevMax) } }, { attr: { d: linePath(after.points, nextMax) }, duration, ease }, 0)
  })
  within(root, '[data-endpoint], [data-end-label]').forEach(node => {
    const si = Number(node.getAttribute('data-series') ?? within(root, '[data-end-label]').indexOf(node))
    const [a, b] = [lastValue(prev.series[si]?.points ?? []), lastValue(next.series[si]?.points ?? [])]
    if (a === undefined || b === undefined) return
    tl.fromTo(node, { top: `${yPercent(a, prevMax)}%` }, { top: `${yPercent(b, nextMax)}%`, duration, ease }, 0)
  })
  countEnds(root, prev, next, options, 0, tl)
  return tl
}

export const lineChartMotion: PieceMotion<LineChartProps> = {
  enter(root, props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const baseline = one(root, '[data-baseline]')
    if (baseline) tl.add(extend(baseline, options), 0)
    within(root, '[data-column]').forEach((column, i) => {
      tl.add(
        options.reduced ?? prefersReducedMotion()
          ? fade(column)
          : gsap.fromTo(column, { scaleY: 0 }, { scaleY: 1, duration: MOVES.extend.in, ease: MOVES.extend.ease }),
        i * COLUMN_STAGGER,
      )
    })
    const layers = within(root, '[data-series-layer]').sort((a, b) => Number(a.dataset.seriesLayer) - Number(b.dataset.seriesLayer))
    layers.forEach((layer, i) => tl.add(draw(layer, { ...options, clip: true }), i * SECOND_SERIES_LAG))
    const landed = MOVES.draw.in - 0.05
    within(root, '[data-endpoint]').forEach((dot, i) => tl.add(pop(dot, options), landed + i * SECOND_SERIES_LAG))
    countEnds(root, null, props, options, landed, tl)
    return tl
  },
  exit(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const out = { ...options, direction: 'out' as const }
    const marks = within(root, '[data-endpoint], [data-end-label]')
    if (marks.length) tl.add(fade(marks, 'out'), 0)
    within(root, '[data-series-layer]').forEach(layer => tl.add(draw(layer, { ...out, clip: true }), 0))
    within(root, '[data-column]').forEach(column =>
      tl.add(gsap.to(column, { scaleY: 0, duration: MOVES.extend.out, ease: EASE.exit }), 0),
    )
    const baseline = one(root, '[data-baseline]')
    if (baseline) tl.add(extend(baseline, out), 0)
    return tl
  },
  update: retrace,
  morph: retrace,
}
