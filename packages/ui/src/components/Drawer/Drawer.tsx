'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import styles from './Drawer.module.css'

/** A sheet from the right edge over the scrim. Escape and the close button dismiss it; focus moves in and back. */
export function Drawer({ open, title, sub, onClose, children }: { open: boolean; title: string; sub?: string; onClose: () => void; children?: ReactNode }) {
  const id = useId()
  const sheet = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    sheet.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      before?.focus()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className={styles.layer} data-piece="Drawer">
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <aside ref={sheet} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <header className={styles.head}>
          <div>
            <h2 id={id} className={styles.title}>
              {title}
            </h2>
            {sub && <p className={styles.sub}>{sub}</p>}
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </aside>
    </div>
  )
}
