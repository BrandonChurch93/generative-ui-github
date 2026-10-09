'use client'

import { useLayoutEffect, useRef } from 'react'
import { TextLink } from '@genui-github/ui'
import { count, wipe } from '@genui-github/ui/motion'
import type { Built } from '@genui-github/renderer'
import styles from './Strip.module.css'
import { MIDDOT, plural, seconds } from './words'

const s = (ms: number) => seconds(ms).toFixed(seconds(ms) < 10 ? 2 : 1)

/** Entrance 7: the strip wipes and the latency figure counts, after the last card. */
export function Strip({
  built,
  sample,
  cachedAt,
  shown = true,
  reduced,
  delay = 0,
  onOpenDrawer,
}: {
  built: Built
  sample: boolean
  cachedAt?: string
  /** False wipes it out: it arrived last, so it leaves first. */
  shown?: boolean
  reduced: boolean
  delay?: number
  onOpenDrawer: () => void
}) {
  const ref = useRef<HTMLParagraphElement>(null)
  const total = useRef<HTMLElement>(null)
  const key = `${built.template}:${built.latencyMs.total}`

  useLayoutEffect(() => {
    if (!ref.current) return
    if (!shown) {
      const out = wipe(ref.current, { direction: 'out', reduced })
      return () => {
        out.progress(1)
        out.kill()
      }
    }
    const tl = wipe(ref.current, { reduced, delay: reduced ? 0 : delay })
    if (total.current) tl.add(count(total.current, { to: seconds(built.latencyMs.total), reduced, format: v => v.toFixed(1) }), reduced ? 0 : 0.2)
    return () => {
      tl.progress(1)
      tl.kill()
    }
    // key stands for the receipt; the object itself changes on every render of the stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, shown, reduced, delay])

  const { latencyMs: t } = built
  const reads = sample ? (
    <span>
      read <b>the sample</b>
      {MIDDOT}no GitHub calls
    </span>
  ) : built.githubReads > 0 ? (
    <span>
      read <b>{plural(built.githubReads, 'GitHub endpoint')}</b>
    </span>
  ) : (
    <span>
      read <b>the cache</b>
      {MIDDOT}no GitHub calls
    </span>
  )

  return (
    <p className={styles.strip} ref={ref} data-built-strip="">
      {reads}
      <span>
        classify <b>{s(t.classify)} s</b>
        {MIDDOT}fetch <b>{s(t.data)} s</b>
        {MIDDOT}compose <b>{s(t.compose)} s</b>
      </span>
      <span>
        composed in{' '}
        <b>
          <span ref={total}>{seconds(t.total).toFixed(1)}</span> s
        </b>
        {cachedAt && `${MIDDOT}opened from cache`}
      </span>
      <span className={styles.end}>
        <TextLink onClick={onOpenDrawer}>How this was built</TextLink>
      </span>
    </p>
  )
}
