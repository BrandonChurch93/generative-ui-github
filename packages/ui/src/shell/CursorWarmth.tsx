'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { MOVES } from '../motion/motion'
import { prefersReducedMotion } from '../motion/primitives'
import styles from './CursorWarmth.module.css'

/**
 * A warm glow that follows the pointer: the one thing on the page not caused by the data.
 * It moves by transform only, once per frame, so following the pointer never costs layout or paint.
 * Off under reduced motion and for touch.
 */
export function CursorWarmth() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    let frame = 0
    let x = 0
    let y = 0
    let shown = false

    const place = () => {
      frame = 0
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
    }
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      x = event.clientX
      y = event.clientY
      if (!frame) frame = requestAnimationFrame(place)
      if (!shown) {
        shown = true
        gsap.to(el, { opacity: 1, duration: MOVES.bloom.up, ease: MOVES.bloom.ease, overwrite: true })
      }
    }
    const onLeave = () => {
      shown = false
      gsap.to(el, { opacity: 0, duration: MOVES.bloom.down, ease: MOVES.bloom.ease, overwrite: true })
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      if (frame) cancelAnimationFrame(frame)
      gsap.killTweensOf(el)
    }
  }, [])

  return <div ref={ref} className={styles.warmth} data-cursor-warmth="" aria-hidden="true" />
}
