'use client'

import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cx } from '../../parts'
import { EASE, fade, formatCount, INTERACTION, prefersReducedMotion, slide, within } from '../../motion'
import type { PieceRenderProps } from '../../types'
import { chipWords, type ChipMode, type ChipOption, type FilterChipsProps } from './schema'
import styles from './FilterChips.module.css'

gsap.registerPlugin(Flip)

/**
 * Which chips fit on one line. Chosen chips never hide; the rest fill in order while there is room for them and
 * the "+N more" chip. Returns null when everything fits.
 */
export function fitChips(widths: number[], chosen: boolean[], available: number, gap: number, moreWidth: number): Set<number> | null {
  const total = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, widths.length - 1)
  if (total <= available) return null
  const shown = new Set<number>()
  let used = moreWidth
  widths.forEach((w, i) => {
    if (chosen[i]) {
      shown.add(i)
      used += gap + w
    }
  })
  for (let i = 0; i < widths.length; i++) {
    if (chosen[i]) continue
    const w = widths[i]!
    if (used + gap + w > available) break
    shown.add(i)
    used += gap + w
  }
  return shown
}

const sameSet = (a: Set<number> | null, b: Set<number> | null) =>
  a === b || (a !== null && b !== null && a.size === b.size && [...a].every(i => b.has(i)))

const chipFor = (row: HTMLElement, value: string) => within(row, '[data-chip]').find(el => el.dataset.chip === value)

function Check() {
  return (
    <span className={styles.checkSlot} data-check="">
      <svg className={styles.check} viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2.5 6.25l2.25 2.25 4.75-5" />
      </svg>
    </span>
  )
}

export interface ChipsFieldProps {
  mode: ChipMode
  options: ChipOption[]
  selected: string[]
  counts?: Record<string, number>
  onChange: (selected: string[]) => void
  /** Counts are on their way: line-soft blocks in their place. */
  counting?: boolean
  disabled?: boolean
  readOnly?: boolean
  ariaLabel?: string
  labelledBy?: string
  /** Where focus goes when a Form sends the reader to this field. */
  id?: string
}

/** The chips themselves: one line, measured, with what does not fit behind "+N more". */
export function ChipsField({ mode, options, selected, counts, onChange, counting, disabled, readOnly, ariaLabel, labelledBy, id }: ChipsFieldProps) {
  const single = mode === 'single'
  const rowRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState<Set<number> | null>(null)
  const [expanded, setExpanded] = useState(false)
  const chooseFlip = useRef<{ state: Flip.FlipState; value: string; focus: boolean } | null>(null)
  const revealing = useRef(false)
  const chosenKey = selected.join('|')

  useLayoutEffect(() => {
    const row = rowRef.current
    const measure = measureRef.current
    if (!row || !measure || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const sizes = [...measure.children].map(c => (c as HTMLElement).offsetWidth)
      const more = sizes.pop() ?? 0
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0
      const next = fitChips(sizes, options.map(o => selected.includes(o.value)), row.clientWidth, gap, more)
      setShown(prev => (sameSet(prev, next) ? prev : next))
    })
    observer.observe(row)
    return () => observer.disconnect()
  }, [options, selected, counting, counts])

  // Choosing: tint and border crossfade in CSS, the check extends in from zero width, the neighbors move with Flip.
  useLayoutEffect(() => {
    const pending = chooseFlip.current
    const row = rowRef.current
    chooseFlip.current = null
    if (!pending || !row) return
    const tl = gsap.timeline()
    const chip = chipFor(row, pending.value)
    const check = chip?.querySelector('[data-check]')
    if (prefersReducedMotion()) {
      if (check) tl.add(fade(check))
    } else {
      tl.add(Flip.from(pending.state, { duration: INTERACTION.chipChoose.default, ease: EASE.arrive }), 0)
      if (check) tl.from(check, { width: 0, duration: INTERACTION.chipChoose.max, ease: EASE.arrive }, 0)
    }
    // Arrow keys move focus with the choice; after Flip has taken hold of the chips, or focus is lost.
    if (pending.focus) chip?.focus()
    return () => {
      tl.progress(1).kill()
    }
  }, [chosenKey])

  useLayoutEffect(() => {
    const row = rowRef.current
    if (!revealing.current || !row) return
    revealing.current = false
    const tl = slide(within(row, '[data-revealed]'))
    return () => {
      tl.progress(1).kill()
    }
  }, [expanded])

  const hidden = shown && !expanded ? options.length - shown.size : 0
  const visible = options.map((o, i) => ({ o, i })).filter(({ i }) => !hidden || shown?.has(i))

  const choose = (value: string, focus = false) => {
    if (disabled || readOnly) return
    const row = rowRef.current
    if (row) chooseFlip.current = { state: Flip.getState(within(row, '[data-chip], [data-more]')), value, focus }
    if (single) {
      if (!selected.includes(value)) onChange([value])
    } else {
      onChange(selected.includes(value) ? selected.filter(v => v !== value) : options.filter(o => o.value === value || selected.includes(o.value)).map(o => o.value))
    }
  }

  const onRadioKey = (event: KeyboardEvent<HTMLButtonElement>, at: number) => {
    const steps: Record<string, number | 'first' | 'last'> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: 'first', End: 'last' }
    const step = steps[event.key]
    if (step === undefined || disabled) return
    event.preventDefault()
    const n = visible.length
    const to = step === 'first' ? 0 : step === 'last' ? n - 1 : (at + step + n) % n
    const target = visible[to]
    if (!target) return
    choose(target.o.value, true)
  }

  const tabStop = single ? (visible.find(({ o }) => selected.includes(o.value)) ?? visible[0])?.o.value : undefined

  return (
    <div
      ref={rowRef}
      id={id}
      className={styles.row}
      role={single ? 'radiogroup' : 'group'}
      aria-label={labelledBy ? undefined : ariaLabel}
      aria-labelledby={labelledBy}
      aria-busy={counting || undefined}
      data-collapsed={hidden > 0 || undefined}
    >
      {counting && <span className="sr-only">{chipWords.counting}</span>}
      {visible.map(({ o, i }, at) => {
        const on = selected.includes(o.value)
        const count = counting ? undefined : counts?.[o.value]
        return (
          <button
            key={o.value}
            type="button"
            className={styles.chip}
            data-chip={o.value}
            data-revealed={expanded && shown && !shown.has(i) ? '' : undefined}
            role={single ? 'radio' : undefined}
            aria-checked={single ? on : undefined}
            aria-pressed={single ? undefined : on}
            aria-label={chipWords.chip(o.label, count)}
            tabIndex={single ? (o.value === tabStop ? 0 : -1) : undefined}
            disabled={disabled}
            onClick={() => choose(o.value)}
            onKeyDown={single ? e => onRadioKey(e, at) : undefined}
          >
            {on && <Check />}
            {o.label}
            {counting ? (
              <span className={styles.countSkeleton} aria-hidden="true" />
            ) : (
              count !== undefined && (
                <span className={styles.count} data-count={o.value}>
                  {formatCount(count, 0)}
                </span>
              )
            )}
          </button>
        )
      })}
      {(hidden > 0 || expanded) && (
        <button
          type="button"
          className={cx(styles.chip, styles.more)}
          data-more=""
          aria-expanded={expanded}
          onClick={() => {
            revealing.current = !expanded
            setExpanded(!expanded)
          }}
        >
          {expanded ? (
            chipWords.less
          ) : (
            <>
              <span className={styles.count}>+{hidden}</span>
              {chipWords.more}
            </>
          )}
        </button>
      )}
      <div ref={measureRef} className={styles.measure} aria-hidden="true">
        {options.map(o => (
          <span key={o.value} className={styles.chip}>
            {selected.includes(o.value) && <Check />}
            {o.label}
            {counting ? (
              <span className={styles.countSkeleton} />
            ) : (
              counts?.[o.value] !== undefined && <span className={styles.count}>{formatCount(counts[o.value]!, 0)}</span>
            )}
          </span>
        ))}
        <span className={cx(styles.chip, styles.more)}>
          <span className={styles.count}>+{options.length}</span>
          {chipWords.more}
        </span>
      </div>
    </div>
  )
}

/** Standalone: on the page ground directly above the list or chart it narrows, its pill edges on the card edges below. */
export function FilterChips({ props, state }: PieceRenderProps<FilterChipsProps>) {
  const [selected, setSelected] = useState(props.selected)
  // A failed target takes the counts with it and disables the chips; the target card owns the error.
  const failed = state === 'error' || state === 'empty'
  const counting = !failed && (state === 'skeleton' || state === 'warming' || props.counts === undefined)
  return (
    <div className={styles.root} data-piece="FilterChips">
      <ChipsField
        mode={props.mode}
        options={props.options}
        selected={selected}
        counts={failed ? undefined : props.counts}
        counting={counting}
        disabled={props.disabled || failed}
        ariaLabel={chipWords.group(props.filters, props.label)}
        onChange={next => {
          setSelected(next)
          props.onChange?.(next)
        }}
      />
    </div>
  )
}
