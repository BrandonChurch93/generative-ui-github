'use client'

import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from './cx'
import styles from './Segmented.module.css'

export interface SegmentedOption<V extends string> {
  value: V
  /** What the segment reads; a node can carry a mono count beside the word. */
  label: ReactNode
  /** A disabled segment stays visible and says why it is off. */
  disabled?: boolean
  reason?: string
}

export interface SegmentedProps<V extends string> {
  label: string
  options: readonly SegmentedOption<V>[]
  value: V
  onChange: (value: V) => void
  className?: string
}

/** A radio group drawn as pills: density in the tray, density and state on the catalog. Arrow keys move and select. */
export function Segmented<V extends string>({ label, options, value, onChange, className }: SegmentedProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const move = (from: number, step: 1 | -1 | 'first' | 'last') => {
    const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter(i => i >= 0)
    if (!enabled.length) return
    let target: number
    if (step === 'first') target = enabled[0]!
    else if (step === 'last') target = enabled.at(-1)!
    else {
      const pos = enabled.indexOf(from)
      target = enabled[(pos + step + enabled.length) % enabled.length]!
    }
    refs.current[target]?.focus()
    onChange(options[target]!.value)
  }

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const keys: Record<string, 1 | -1 | 'first' | 'last'> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
      Home: 'first',
      End: 'last',
    }
    const step = keys[event.key]
    if (step === undefined) return
    event.preventDefault()
    move(index, step)
  }

  return (
    <div role="radiogroup" aria-label={label} className={cx(styles.group, className)}>
      {options.map((option, index) => {
        const checked = option.value === value
        return (
          <button
            key={option.value}
            ref={el => {
              refs.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={option.disabled || undefined}
            tabIndex={checked ? 0 : -1}
            title={option.disabled ? option.reason : undefined}
            className={styles.segment}
            onClick={() => !option.disabled && onChange(option.value)}
            onKeyDown={event => onKeyDown(event, index)}
          >
            {option.label}
            {option.disabled && option.reason && <span className="sr-only">. Not available: {option.reason}</span>}
          </button>
        )
      })}
    </div>
  )
}
