import { gsap } from 'gsap'
import { draw, fade, MOVES, one, pop, prefersReducedMotion, type MoveOptions, type PieceMotion } from '../../motion'
import { sparkGeometry } from './geometry'
import type { SparklineProps } from './Sparkline'

const box = (root: HTMLElement) => one(root, '[data-spark] [role="img"]')

function retrace(root: HTMLElement, prev: SparklineProps, next: SparklineProps, options: MoveOptions = {}) {
  const tl = gsap.timeline()
  const from = sparkGeometry(prev.points ?? [])
  const to = sparkGeometry(next.points ?? [])
  const line = one(root, '[data-spark-line]')
  const latest = one(root, '[data-spark-latest]')
  const end = one(root, '[data-spark-end]')
  if (!from || !to || !line || !latest || !end) return tl
  if (options.reduced ?? prefersReducedMotion()) return fade([line, latest, end])
  const { duration, ease } = MOVES.count
  tl.fromTo(line, { attr: { d: from.line } }, { attr: { d: to.line }, duration, ease }, 0)
  tl.fromTo(latest, { attr: { d: from.latest } }, { attr: { d: to.latest }, duration, ease }, 0)
  tl.fromTo(end, { '--end-y': `${from.end.y}%` }, { '--end-y': `${to.end.y}%`, duration, ease }, 0)
  return tl
}

export const sparklineMotion: PieceMotion<SparklineProps> = {
  enter(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const target = box(root)
    if (!target) return tl
    tl.add(draw(target, { ...options, clip: true }))
    const end = one(root, '[data-spark-end]')
    if (end) tl.add(pop(end, options), '>-0.05')
    return tl
  },
  exit(root, _props, options = {}) {
    const target = box(root)
    return target ? draw(target, { ...options, clip: true, direction: 'out' }) : gsap.timeline()
  },
  update: (root, prev, next, options) => retrace(root, prev, next, options),
  morph: (root, prev, next, options) => retrace(root, prev, next, options),
}
