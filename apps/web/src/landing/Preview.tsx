'use client'

import Link from 'next/link'
import { useSyncExternalStore, type ReactNode } from 'react'
import { RepoChip } from '@genui-github/ui'
import dynamic from 'next/dynamic'
import type { Composition } from '@genui-github/renderer'

// Decoration below the fold on a phone: it loads after the page paints.
const Renderer = dynamic(() => import('@genui-github/renderer').then(m => m.Renderer), { ssr: false })
import { MIDDOT, modelName, pieceCount, plural, seconds, templateLine } from '../shell/words'
import { repoPath } from './repoInput'
import styles from './Landing.module.css'

export interface LandingPreview {
  repo: string
  question: string
  /** A committed golden composition: GitHub's data, never a sample.json. */
  composition: Composition
  sampleDay?: string
}

/**
 * A composed answer laid out at a screen's width and scaled into its frame. The picture is decoration, so it is
 * hidden and inert; the frame's link opens the same answer for real.
 */
const noSubscribe = () => () => {}

export function Preview({ preview, action }: { preview: LandingPreview; action: ReactNode }) {
  const { repo, question, composition, sampleDay } = preview
  // The answer renders in the browser only: the server cannot know the reader's motion preference, and the
  // pieces' first frame depends on it. The frame's fixed ratio keeps the page still while it arrives.
  const browser = useSyncExternalStore(noSubscribe, () => true, () => false)
  const built = composition.built
  const time = built ? seconds(built.latencyMs.total).toFixed(1) : undefined
  return (
    <figure className={styles.fig}>
      <div className={styles.shot}>
        <div className={styles.shotIn} aria-hidden="true" inert>
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
          {browser && <Renderer composition={composition} />}
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
        {action}
      </figcaption>
    </figure>
  )
}
