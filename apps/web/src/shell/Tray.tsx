'use client'

import { useState, type FormEvent } from 'react'
import { Mark, Segmented, type Density } from '@genui-github/ui'
import styles from './Tray.module.css'

const DENSITIES = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'spacious', label: 'Spacious' },
] as const

export interface TrayProps {
  repo: string
  density: Density
  onDensity: (density: Density) => void
  onAsk: (question: string) => void
  /** When the app can't take a question, the tray says when it can: "New questions open at 17:58 UTC". */
  closedUntil?: string
}

export function Tray({ repo, density, onDensity, onAsk, closedUntil }: TrayProps) {
  const [text, setText] = useState('')
  const closed = closedUntil !== undefined
  const ready = !closed && text.trim().length > 0

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!ready) return
    onAsk(text.trim())
    setText('')
  }

  return (
    <form className={styles.tray} onSubmit={submit} role="search" aria-label="Ask" data-tray="">
      <label className={styles.ask}>
        {closed && <Mark kind="unavailable" />}
        <span className="sr-only">{closed ? `Question field, closed. New questions open at ${closedUntil}` : `Ask another question about ${repo}`}</span>
        <input
          className={styles.input}
          name="question"
          type="text"
          autoComplete="off"
          enterKeyHint="send"
          maxLength={300}
          placeholder={closed ? `New questions open at ${closedUntil}` : `Ask another question about ${repo}`}
          value={closed ? '' : text}
          disabled={closed}
          onChange={e => setText(e.target.value)}
        />
      </label>
      <button type="submit" className={styles.send} data-ready={ready ? '' : undefined} disabled={closed} aria-label="Ask">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 13V3" />
          <path d="M4 7l4-4 4 4" />
        </svg>
      </button>
      <span className={styles.rule} aria-hidden="true" />
      <Segmented label="Density" options={DENSITIES} value={density} onChange={onDensity} className={styles.density} />
    </form>
  )
}
