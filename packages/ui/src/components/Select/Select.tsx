'use client'

import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type Ref } from 'react'
import { CardFrame, cx } from '../../parts'
import type { PieceRenderProps } from '../../types'
import { MessageSlot } from '../TextInput/MessageSlot'
import { fieldWords, lower, type FieldMessage } from '../TextInput/schema'
import fieldStyles from '../TextInput/TextInput.module.css'
import { menuMotion } from './motion'
import type { SelectOption, SelectProps } from './schema'
import styles from './Select.module.css'

/** How long typed letters keep adding to one search before a new search starts. */
const TYPEAHEAD_MS = 500

const COARSE = '(pointer: coarse)'
function subscribeCoarse(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(COARSE)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
const coarseNow = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(COARSE).matches

/** Phones get their own wheel: on a coarse pointer the styled trigger is a native select. */
function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribeCoarse, coarseNow, () => false)
}

function Chevron({ className, ref }: { className?: string; ref?: Ref<SVGSVGElement> }) {
  return (
    <svg ref={ref} className={cx(styles.chevron, className)} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

function Check({ on }: { on: boolean }) {
  return (
    <svg className={styles.check} data-on={on || undefined} viewBox="0 0 16 16" aria-hidden="true">
      {on && <path d="M3.5 8.5l3 3 6-7" />}
    </svg>
  )
}

/** Finds the option a typed search points at. Repeating one letter cycles through the options it starts. */
export function typeaheadMatch(options: readonly SelectOption[], query: string, from: number): number {
  const n = options.length
  if (!n || !query) return -1
  const q = query.toLowerCase()
  const cycling = q.length > 1 && [...q].every(c => c === q[0])
  const needle = cycling ? q[0]! : q
  // A fresh single letter or a cycle moves past the current option; a longer search may stay on it.
  const offset = q.length === 1 || cycling ? 1 : 0
  for (let k = 0; k < n; k++) {
    const i = (from + offset + k + n) % n
    if (options[i]!.label.toLowerCase().startsWith(needle)) return i
  }
  return -1
}

export interface SelectFieldProps {
  id: string
  field: Pick<SelectProps, 'label' | 'options' | 'placeholder' | 'required'>
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  message?: FieldMessage
  disabled?: boolean
  readOnly?: boolean
  onRetry?: () => void
}

/** The bare field group (label, trigger and menu, message slot) that a Form lays out on its own surface. */
export function SelectField({ id, field: spec, value, onChange, onBlur, message, disabled, readOnly, onRetry }: SelectFieldProps) {
  const { label, options, placeholder, required } = spec
  const coarse = useCoarsePointer()
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(false)
  const [active, setActive] = useState(-1)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const chevronRef = useRef<SVGSVGElement>(null)
  const search = useRef({ text: '', timer: 0 })
  const wasOpen = useRef(false)

  const ids = { label: `${id}-label`, value: `${id}-value`, list: `${id}-list`, message: `${id}-message` }
  const optionId = (i: number) => `${id}-option-${i}`
  const chosen = options.findIndex(o => o.value === value)
  const off = disabled || options.length === 0
  const invalid = message?.kind === 'invalid'

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (open === wasOpen.current || !menu) return
    wasOpen.current = open
    const tl = menuMotion(menu, chevronRef.current, open ? 'in' : 'out')
    if (!open) tl.eventCallback('onComplete', () => setShown(false))
    // Killed, not finished: finishing a close that a reopen interrupted would unmount the reopened menu.
    return () => {
      tl.kill()
    }
  }, [open, shown])

  useLayoutEffect(() => {
    if (!open || active < 0) return
    const row = document.getElementById(optionId(active))
    if (typeof row?.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' })
  })

  const openAt = (index: number) => {
    setActive(index)
    setOpen(true)
    setShown(true)
  }
  const close = () => setOpen(false)
  const choose = (index: number) => {
    const option = options[index]
    if (option) onChange(option.value)
    close()
  }
  const start = () => (chosen >= 0 ? chosen : 0)

  const typeahead = (char: string) => {
    const s = search.current
    window.clearTimeout(s.timer)
    s.text += char
    s.timer = window.setTimeout(() => (s.text = ''), TYPEAHEAD_MS)
    const from = open ? active : chosen
    const found = typeaheadMatch(options, s.text, from < 0 ? -1 : from)
    if (found < 0) return
    if (open) setActive(found)
    else openAt(found)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (off || readOnly) return
    const last = options.length - 1
    const key = event.key
    const typing = search.current.text !== ''
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault()
      if (!open) openAt(start())
      else setActive(a => (key === 'ArrowDown' ? Math.min(a + 1, last) : Math.max(a - 1, 0)))
    } else if (key === 'Home' || key === 'End') {
      event.preventDefault()
      const to = key === 'Home' ? 0 : last
      if (open) setActive(to)
      else openAt(to)
    } else if (key === 'Enter' || (key === ' ' && !typing)) {
      event.preventDefault()
      if (open) choose(active)
      else openAt(start())
    } else if (key === 'Escape') {
      if (!open) return
      // Escape closes the menu without changing the value, and goes no further than the menu.
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (key === 'Tab') {
      if (open) close()
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      typeahead(key)
    }
  }

  const labelEl = (
    <label
      id={ids.label}
      htmlFor={id}
      className={fieldStyles.label}
      data-off={off || undefined}
      // A label click on a button would toggle the menu; it only moves focus, as a label does for a text field.
      onClick={
        coarse
          ? undefined
          : event => {
              event.preventDefault()
              triggerRef.current?.focus()
            }
      }
    >
      {label}
      {required === false && <span className={fieldStyles.optional}> {fieldWords.optional}</span>}
    </label>
  )

  if (coarse) {
    return (
      <div className={fieldStyles.group} data-field-group="">
        {labelEl}
        <div className={styles.box}>
          <select
            id={id}
            className={cx(fieldStyles.control, styles.trigger, styles.native)}
            value={chosen >= 0 ? value : ''}
            disabled={off}
            aria-invalid={invalid || undefined}
            aria-describedby={ids.message}
            onChange={e => !readOnly && onChange(e.target.value)}
            onBlur={onBlur}
          >
            {chosen < 0 && (
              <option value="" disabled>
                {placeholder ?? ''}
              </option>
            )}
            {options.map(o => (
              <option key={o.value} value={o.value}>
                {o.meta ? `${o.label} · ${o.meta}` : o.label}
              </option>
            ))}
          </select>
          <Chevron className={styles.nativeChevron} />
        </div>
        <MessageSlot id={ids.message} message={message} onRetry={onRetry} />
      </div>
    )
  }

  return (
    <div className={fieldStyles.group} data-field-group="">
      {labelEl}
      <div className={styles.box}>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          role="combobox"
          className={cx(fieldStyles.control, styles.trigger)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={ids.list}
          aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
          aria-labelledby={`${ids.label} ${ids.value}`}
          aria-describedby={ids.message}
          aria-invalid={invalid || undefined}
          aria-required={required !== false || undefined}
          aria-readonly={readOnly || undefined}
          disabled={off}
          onClick={() => {
            if (readOnly) return
            if (open) close()
            else openAt(start())
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (open) close()
            onBlur?.()
          }}
        >
          <span id={ids.value} className={styles.value} data-placeholder={chosen < 0 || undefined}>
            {chosen >= 0 ? options[chosen]!.label : (placeholder ?? '')}
          </span>
          <Chevron ref={chevronRef} />
        </button>
        {shown && (
          <ul
            ref={menuRef}
            id={ids.list}
            role="listbox"
            aria-labelledby={ids.label}
            className={styles.menu}
            data-menu=""
            // Focus stays on the trigger while the pointer picks.
            onMouseDown={e => e.preventDefault()}
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                id={optionId(i)}
                role="option"
                aria-selected={i === chosen}
                className={styles.option}
                data-active={i === active || undefined}
                onMouseMove={() => i !== active && setActive(i)}
                onClick={() => choose(i)}
              >
                <span className={styles.optionLabel}>{o.label}</span>
                {o.meta && <span className={styles.meta}>{o.meta}</span>}
                <Check on={i === chosen} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <MessageSlot id={ids.message} message={message} onRetry={onRetry} />
    </div>
  )
}

/** Resolves what a Select's slot says. Options come from data on screen, so only `invalid` comes from a check. */
export function selectMessage(props: Pick<SelectProps, 'label' | 'helper' | 'disabled' | 'reason' | 'options' | 'status'>): FieldMessage | undefined {
  if (props.options.length === 0) return { kind: 'helper', text: props.reason ?? fieldWords.noOptions(props.label) }
  if (props.disabled && props.reason) return { kind: 'helper', text: props.reason }
  if (props.status?.kind === 'invalid') return { kind: 'invalid', text: fieldWords.problem(props.status.problem, props) }
  return props.helper ? { kind: 'helper', text: props.helper } : undefined
}

/** A Select shown on its own, in the catalog inside a card. A composed screen only ever shows it inside a Form. */
export function Select({ props, state, error, onRetry }: PieceRenderProps<SelectProps>) {
  const id = useId()
  const [value, setValue] = useState(props.value)
  const message: FieldMessage | undefined =
    state === 'error'
      ? { kind: 'unreachable', failed: error?.failed ?? `Couldn't load ${lower(props.label)} options`, cause: error?.cause ?? '' }
      : selectMessage(props)
  return (
    <CardFrame as="div" className={styles.card}>
      <div className={fieldStyles.body}>
        <SelectField
          id={id}
          field={props}
          value={value}
          onChange={next => {
            setValue(next)
            props.onChange?.(next)
          }}
          message={message}
          disabled={props.disabled}
          onRetry={onRetry}
        />
      </div>
    </CardFrame>
  )
}
