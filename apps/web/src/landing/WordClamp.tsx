'use client'

import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Text cut to a number of lines at a word boundary, never inside a word: a CSS line clamp cuts mid word when the
 * last fitting word is long. Measures once laid out and again when the box changes width; the whole text stays
 * in the accessible name.
 */
export function WordClamp({ text, lines, className, id }: { text: string; lines: number; className?: string; id?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(text)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      const style = getComputedStyle(el)
      const max = parseFloat(style.lineHeight) * lines + 1
      el.textContent = text
      if (el.scrollHeight <= max) return setShown(text)
      const words = text.split(/\s+/)
      let lo = 1
      let hi = words.length - 1
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2)
        el.textContent = `${words.slice(0, mid).join(' ')}…`
        if (el.scrollHeight <= max) lo = mid
        else hi = mid - 1
      }
      const cut = `${words.slice(0, lo).join(' ').replace(/[,;:.\s]+$/, '')}…`
      el.textContent = cut
      setShown(cut)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text, lines])

  return (
    <span ref={ref} className={className} id={id} aria-label={shown !== text ? text : undefined} data-clamped={shown !== text || undefined}>
      {shown}
    </span>
  )
}
