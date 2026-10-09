'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { RepoChip } from '@genui-github/ui'
import type { Composition } from '@genui-github/renderer'
import { MIDDOT, modelName, pieceCount, plural, seconds, templateLine } from '../shell/words'
import { repoPath } from './repoInput'
import styles from './HowItWorks.module.css'

// Decoration below the fold: it loads once the reader nears it, never on first paint.
const Renderer = dynamic(() => import('@genui-github/renderer').then(m => m.Renderer), { ssr: false })

export interface LandingPreview {
  repo: string
  question: string
  /** A committed golden composition: GitHub's data, never a sample.json. */
  composition: Composition
  sampleDay?: string
}

/** What each numbered callout points at, in the order of the three steps. */
const TARGETS = [
  "[data-region='insight'] [data-piece='Insight']",
  "[data-region='metrics'] [data-hot]",
  "[data-region='main'] li:nth-child(2)",
] as const

interface Box {
  x: number
  y: number
  w: number
  h: number
}

const same = (a: (Box | null)[], b: (Box | null)[]) =>
  a.length === b.length && a.every((box, i) => {
    const other = b[i]
    if (!box || !other) return box === other
    return box.x === other.x && box.y === other.y && box.w === other.w && box.h === other.h
  })

/**
 * A composed answer laid out at a screen's width and scaled into its frame, with numbered callouts over the
 * insight, the hot metric and a clickable row. The picture and the callouts are decoration, so they are hidden
 * and inert; the steps beside it carry the words, and the frame's link opens the same answer for real.
 */
export function Preview({ preview }: { preview: LandingPreview }) {
  const { repo, question, composition, sampleDay } = preview
  const frame = useRef<HTMLDivElement>(null)
  const picture = useRef<HTMLDivElement>(null)
  // The answer renders in the browser only, once the frame is near: the server cannot know the reader's motion
  // preference, and the pieces' first frame depends on it. The frame's fixed ratio keeps the page still.
  const [near, setNear] = useState(false)
  const [boxes, setBoxes] = useState<(Box | null)[]>([])
  const built = composition.built
  const time = built ? seconds(built.latencyMs.total).toFixed(1) : undefined

  useEffect(() => {
    const el = frame.current
    if (!el) return
    const watch = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setNear(true)
          watch.disconnect()
        }
      },
      { rootMargin: '50% 0px' },
    )
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  // The callouts are placed where the pieces settle, and again whenever the frame changes size.
  useEffect(() => {
    const el = frame.current
    const inner = picture.current
    if (!near || !el || !inner) return
    const measure = () => {
      if (!inner.querySelector("[data-phase='settled']")) return
      const origin = el.getBoundingClientRect()
      const next = TARGETS.map(selector => {
        const target = inner.querySelector(selector)
        if (!target) return null
        const r = target.getBoundingClientRect()
        return { x: Math.round(r.left - origin.left), y: Math.round(r.top - origin.top), w: Math.round(r.width), h: Math.round(r.height) }
      })
      setBoxes(prev => (same(prev, next) ? prev : next))
    }
    const settle = new MutationObserver(measure)
    settle.observe(inner, { subtree: true, childList: true, attributeFilter: ['data-phase'] })
    const size = new ResizeObserver(measure)
    size.observe(el)
    measure()
    return () => {
      settle.disconnect()
      size.disconnect()
    }
  }, [near])

  return (
    <figure className={styles.fig}>
      <div ref={frame} className={styles.shot}>
        <div ref={picture} className={styles.shotIn} aria-hidden="true" inert>
          <div className={styles.shotChrome}>
            <div>
              <div className={styles.shotEyebrow}>
                <RepoChip repo={repo} />
                {sampleDay && (
                  <span className={styles.shotChip}>
                    sample{MIDDOT}read {sampleDay}
                  </span>
                )}
              </div>
              <p className={styles.shotQuestion}>{question}</p>
            </div>
            {built && (
              <div className={styles.shotBuilt}>
                <span className={styles.shotNum}>
                  {time}
                  <small>s</small>
                </span>
                <span className={styles.shotMeta}>
                  composed by {modelName(built.model)}
                  {MIDDOT}
                  {plural(pieceCount(composition.regions), 'component')}
                </span>
                <span className={styles.shotMeta}>{templateLine(built)}</span>
              </div>
            )}
          </div>
          {near && <Renderer composition={composition} />}
        </div>
        <div className={styles.callouts} aria-hidden="true" data-callouts={boxes.some(Boolean) ? 'placed' : undefined}>
          {boxes.map((box, i) =>
            box ? (
              <span
                key={TARGETS[i]}
                className={styles.callout}
                style={{ '--x': `${box.x}px`, '--y': `${box.y}px`, '--w': `${box.w}px`, '--h': `${box.h}px` } as CSSProperties}
                data-callout={i + 1}
              >
                <span className={styles.badge}>{i + 1}</span>
              </span>
            ) : null,
          )}
        </div>
        <Link className={styles.shotLink} href={repoPath(repo, question)} prefetch={false} aria-label={`Open the sample answer to ${question} on ${repo}`} />
      </div>
      <figcaption className={styles.cap}>
        <span>
          an answer for <b>{repo}</b>
        </span>
        {time && (
          <span>
            composed in <b>{time}&#160;s</b>
          </span>
        )}
      </figcaption>
    </figure>
  )
}
