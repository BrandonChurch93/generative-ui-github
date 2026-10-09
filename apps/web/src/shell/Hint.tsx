'use client'

import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { gsap } from 'gsap'
import { wipe } from '@genui-github/ui/motion'
import styles from './Hint.module.css'

export const HINT_WORDS = 'Click any card, row or point. The screen rebuilds around it.'

const HINT_KEY = 'genui:hint'
const HINT_EVENT = 'genui:hint'
/** Where the dismissal lives when storage refuses it, as in some private windows. */
let fallback = false

function dismissed(): boolean {
  try {
    return sessionStorage.getItem(HINT_KEY) === 'done' || fallback
  } catch {
    return fallback
  }
}

const onHintChange = (notify: () => void) => {
  window.addEventListener(HINT_EVENT, notify)
  return () => window.removeEventListener(HINT_EVENT, notify)
}

/**
 * Whether the reader has clicked into an answer yet this session, and the call that records it.
 * The server snapshot says dismissed, so the hint never flashes in before storage is read.
 */
export function useHintDismissed(): [boolean, () => void] {
  const value = useSyncExternalStore(onHintChange, dismissed, () => true)
  const dismiss = useCallback(() => {
    if (dismissed()) return
    fallback = true
    try {
      sessionStorage.setItem(HINT_KEY, 'done')
    } catch {
      // Storage refused; the flag above keeps the dismissal for as long as this page lives.
    }
    window.dispatchEvent(new Event(HINT_EVENT))
  }, [])
  return [value, dismiss]
}

const kill = (tl: gsap.core.Timeline | null) => {
  tl?.progress(1)
  tl?.kill()
}

/**
 * The first-visit line under the chrome. It wipes in as the chrome's last line and wipes out the same way,
 * then leaves the page. A plain paragraph, not a live region: a screen reader meets it once, in reading order.
 */
export function Hint({ show, reduced, delay = 0 }: { show: boolean; reduced: boolean; delay?: number }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [mounted, setMounted] = useState(show)
  if (show && !mounted) setMounted(true)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (show) {
      const tl = wipe(el, { reduced, delay: reduced ? 0 : delay })
      return () => kill(tl)
    }
    const tl = wipe(el, { direction: 'out', reduced })
    tl.eventCallback('onComplete', () => setMounted(false))
    return () => {
      // Interrupted (shown again, or the page leaving): finish the move without unmounting what is coming back.
      tl.eventCallback('onComplete', null)
      kill(tl)
    }
  }, [show, reduced, delay])

  if (!mounted) return null
  return (
    <p className={styles.hint} ref={ref} data-hint="">
      {HINT_WORDS}
    </p>
  )
}
