'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, type RefObject } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { MOVES, REDUCED, riseVariants, slide } from '@genui-github/ui/motion'
import styles from './HowItWorks.module.css'

/** The four layers, in the system's words. Each claim here is what the code does. */
const STEPS = [
  {
    title: 'You paste a public repo',
    body: 'Any public GitHub repo, as owner/name or a link. Then ask in your own words, or pick one of the twelve questions.',
  },
  {
    title: 'A model picks the layout',
    body: 'Haiku matches the question to one of 15 layout templates, and when none fits, Sonnet composes a screen of its own. Either way it chooses only meaning, like tone and emphasis.',
  },
  {
    title: 'The system binds and checks it',
    body: "Code fills every figure from GitHub's public data and checks each number the model writes against it. A number that doesn't match is never shown.",
  },
  {
    title: 'The renderer draws it',
    body: "Each piece comes from a hand-built catalog that owns every color and size. Every answer lists what was read, chosen and timed.",
  },
] as const

const reducedCard = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: REDUCED.duration, ease: 'linear' as const } },
  gone: { opacity: 0, transition: { duration: REDUCED.duration, ease: 'linear' as const } },
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The "how this works" overlay (`screens/HowItWorks.html`). The card rises, then its steps slide in; closing runs
 * that backwards. Escape, the close button and the scrim close it; focus stays inside and returns to the opener.
 */
export function HowItWorks({ open, onClose, opener }: { open: boolean; onClose: () => void; opener: RefObject<HTMLElement | null> }) {
  const media = useReducedMotion()
  const reduced = media ?? false
  const wasOpen = useRef(false)

  // The page behind stops being inert in the same commit that closes the overlay, so focus can go back now.
  useEffect(() => {
    if (open) {
      wasOpen.current = true
      return
    }
    if (!wasOpen.current) return
    wasOpen.current = false
    opener.current?.focus()
  }, [open, opener])

  return <AnimatePresence>{open && <Layer key="how" onClose={onClose} reduced={reduced} />}</AnimatePresence>
}

function Layer({ onClose, reduced }: { onClose: () => void; reduced: boolean }) {
  const titleId = useId()
  const card = useRef<HTMLElement>(null)
  const steps = useRef<HTMLOListElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const leaving = useRef(false)

  useLayoutEffect(() => {
    if (!steps.current) return
    close.current?.focus()
    const tl = slide([...steps.current.children], { reduced, delay: reduced ? 0 : MOVES.rise.in / 2 })
    return () => {
      tl.kill()
    }
  }, [reduced])

  // Exit is the entrance reversed: the steps slide out last to first, then the card sinks.
  const dismiss = useCallback(() => {
    if (leaving.current) return
    leaving.current = true
    const list = steps.current
    if (!list) return onClose()
    const tl = slide([...list.children].reverse(), { direction: 'out', reduced })
    tl.eventCallback('onComplete', onClose)
  }, [onClose, reduced])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        dismiss()
        return
      }
      if (event.key !== 'Tab' || !card.current) return
      const stops = [...card.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const first = stops[0]
      const last = stops.at(-1)
      if (!first || !last) return
      const inside = card.current.contains(document.activeElement)
      if (event.shiftKey && (document.activeElement === first || !inside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dismiss])

  const variants = reduced ? reducedCard : riseVariants
  const scrimTiming = reduced ? { duration: REDUCED.duration } : { duration: MOVES.rise.in }

  return (
    <div className={styles.layer} data-how-layer="">
      <motion.div
        className={styles.scrim}
        onClick={dismiss}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: scrimTiming }}
        exit={{ opacity: 0, transition: reduced ? scrimTiming : { duration: MOVES.rise.out } }}
      />
      <motion.section
        ref={card}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        variants={variants}
        initial="hidden"
        animate="shown"
        exit="gone"
      >
        <div className={styles.head}>
          <h2 className={styles.title} id={titleId}>
            How this works
          </h2>
          <button ref={close} type="button" className={styles.x} onClick={dismiss} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 4l8 8" />
              <path d="M12 4l-8 8" />
            </svg>
          </button>
        </div>
        <ol className={styles.steps} ref={steps}>
          {STEPS.map(step => (
            <li key={step.title}>
              <b>{step.title}</b>
              <span>{step.body}</span>
            </li>
          ))}
        </ol>
        <div className={styles.foot}>
          <span>open source · MIT</span>
          <Link className={styles.link} href="/about">
            More on the About page
          </Link>
        </div>
      </motion.section>
    </div>
  )
}
