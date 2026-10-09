import { gsap } from 'gsap'
import { count, extend, one, type MoveOptions, type PieceMotion } from '../../motion'
import { formatShare, shareOf } from './Progress'
import type { ProgressProps } from './schema'

const shareOfProps = (props: ProgressProps) => shareOf(props.count, props.total)

/** The figure and its share count together, so the meta line never disagrees with the number above it. */
function countTo(root: HTMLElement, from: ProgressProps | null, to: ProgressProps, options: MoveOptions) {
  const tl = gsap.timeline()
  const number = one(root, '[data-number]')
  if (number) tl.add(count(number, { ...options, from: from?.count ?? 0, to: to.count, format: v => Math.round(v).toLocaleString('en-US') }), 0)
  const share = one(root, '[data-share]')
  const target = shareOfProps(to) * 100
  // A sliver reads "<1"; counting would flash whole numbers it never was.
  if (share && (target === 0 || target >= 1)) {
    tl.add(count(share, { ...options, from: from ? shareOfProps(from) * 100 : 0, to: target, format: v => formatShare(Math.round(v)) }), 0)
  }
  return tl
}

function refill(root: HTMLElement, prev: ProgressProps, next: ProgressProps, options: MoveOptions = {}) {
  const tl = gsap.timeline()
  const inner = { ...options, delay: 0 }
  const fill = one(root, '[data-fill]')
  if (fill) tl.add(extend(fill, { ...inner, from: shareOfProps(prev), to: shareOfProps(next) }), 0)
  tl.add(countTo(root, prev, next, inner), 0)
  return tl
}

export const progressMotion: PieceMotion<ProgressProps> = {
  enter(root, props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const inner = { ...options, delay: 0 }
    const fill = one(root, '[data-fill]')
    if (fill) tl.add(extend(fill, { ...inner, to: shareOfProps(props) }), 0)
    tl.add(countTo(root, null, props, inner), 0)
    return tl
  },
  exit(root, props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const fill = one(root, '[data-fill]')
    if (fill) tl.add(extend(fill, { ...options, delay: 0, direction: 'out', from: shareOfProps(props) }), 0)
    return tl
  },
  update: refill,
  morph: refill,
}
