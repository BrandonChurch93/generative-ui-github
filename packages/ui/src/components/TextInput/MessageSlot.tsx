'use client'

import { useLayoutEffect, useRef } from 'react'
import { cx, Mark, TextLink } from '../../parts'
import { swapMessage } from './motion'
import type { FieldMessage } from './schema'
import styles from './TextInput.module.css'

/**
 * The one line under a field. Helper, error, checking and unreachable take the same slot, so nothing below shifts
 * when one replaces another. The stage keeps its id for `aria-describedby` whatever it holds.
 */
export function MessageSlot({
  id,
  message,
  onRetry,
  className,
}: {
  id: string
  message?: FieldMessage
  onRetry?: () => void
  className?: string
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const ghost = useRef<HTMLElement | null>(null)
  const lastKey = useRef<string | null>(null)
  const key = message ? JSON.stringify(message) : ''

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const line = stage.querySelector<HTMLElement>('[data-message-line]')
    const old = ghost.current
    const changed = lastKey.current !== null && lastKey.current !== key
    lastKey.current = key
    // The clone is the outgoing line next time: React has already replaced the real one when the next effect runs.
    ghost.current = line ? (line.cloneNode(true) as HTMLElement) : null
    if (!changed || (!old && !line)) return
    if (old) {
      old.setAttribute('aria-hidden', 'true')
      old.inert = true
      old.classList.add(styles.leaving!)
      stage.appendChild(old)
    }
    const tl = swapMessage(old, line)
    tl.eventCallback('onComplete', () => old?.remove())
    return () => {
      tl.progress(1).kill()
      old?.remove()
    }
  }, [key])

  return (
    <div ref={stageRef} id={id} className={cx(styles.stage, className)} aria-live="polite">
      {message && (
        <p className={styles.message} data-message-line="" data-kind={message.kind}>
          {message.kind === 'invalid' && <span className={styles.messageMark}><Mark kind="crit" /></span>}
          {message.kind === 'unreachable' && <span className={styles.messageMark}><Mark kind="unavailable" /></span>}
          {message.kind === 'checking' && <span className={styles.messageMark}><Mark kind="warming" /></span>}
          {message.kind === 'resolved' && (
            <svg className={styles.check} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-check="">
              <path d="M2.5 6.25L5 8.75L9.5 3.5" />
            </svg>
          )}
          {message.kind === 'unreachable' ? (
            <span className={styles.messageText}>
              <span className={styles.ink}>{message.failed}</span>
              <span className={styles.fact}> · {message.cause}</span>
            </span>
          ) : (
            <span className={styles.messageText}>{message.text}</span>
          )}
          {message.kind === 'unreachable' && onRetry && (
            <TextLink size="hint" onClick={onRetry} className={styles.retry}>
              Try again
            </TextLink>
          )}
        </p>
      )}
    </div>
  )
}
