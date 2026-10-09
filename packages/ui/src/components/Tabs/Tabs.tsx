'use client'

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import styles from './Tabs.module.css'

export interface Tab {
  id: string
  label: string
  content: ReactNode
}

/** Panels behind a row of tabs. Arrow keys move between tabs; the selected tab is the only tab stop. */
export function Tabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  const [selected, setSelected] = useState(tabs[0]?.id)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const base = useId()
  const onKey = (e: KeyboardEvent, i: number) => {
    const next = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1
    if (next < 0) return
    e.preventDefault()
    setSelected(tabs[next]!.id)
    refs.current[next]?.focus()
  }
  return (
    <div className={styles.tabs} data-piece="Tabs">
      <div role="tablist" aria-label={label} className={styles.list}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={el => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`${base}-${t.id}`}
            aria-selected={t.id === selected}
            aria-controls={`${base}-${t.id}-panel`}
            tabIndex={t.id === selected ? 0 : -1}
            className={styles.tab}
            onClick={() => setSelected(t.id)}
            onKeyDown={e => onKey(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map(t => (
        <div key={t.id} role="tabpanel" id={`${base}-${t.id}-panel`} aria-labelledby={`${base}-${t.id}`} hidden={t.id !== selected} className={styles.panel}>
          {t.content}
        </div>
      ))}
    </div>
  )
}
