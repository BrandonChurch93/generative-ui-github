'use client'

import dynamic from 'next/dynamic'
import { RepoChip } from '@genui-github/ui'
import type { Composition } from '@genui-github/renderer'
import frame from '../shell/Frame.module.css'
import styles from './Thumbnail.module.css'

// Browser only, as on the landing: the pieces' first frame depends on the motion preference.
const Renderer = dynamic(() => import('@genui-github/renderer').then(m => m.Renderer), { ssr: false })

const HEADLINE = {
  portfolio: ['Paste a GitHub repo, ask a question,', 'and an agent composes the interface that answers it.'],
  og: ['An agent that composes UIs from GitHub repo data'],
} as const

/**
 * One still: the wordmark, the headline, and the real golden answer in a card cropped by the frame's bottom edge.
 * Drawn in its final state: the renderer runs reduced, so every move is a short fade and every count lands.
 */
export function Thumbnail({ size, composition }: { size: 'portfolio' | 'og'; composition: Composition | null }) {
  const lines = HEADLINE[size]
  return (
    <div className={styles.canvas} data-size={size} data-thumbnail="">
      <span className={`${frame.wordmark} ${styles.wordmark}`}>
        <span>Generative UI</span>
        <RepoChip repo="github" className={frame.wordmarkChip} />
      </span>
      <h1 className={styles.headline}>
        {lines.map((line, i) => (
          <span key={line} className={i === 0 && lines.length > 1 ? styles.lead : styles.line}>
            {line}
          </span>
        ))}
      </h1>
      <div className={styles.card} aria-hidden="true">
        <div className={styles.screen}>{composition && <Renderer composition={composition} density="comfortable" reduced />}</div>
      </div>
    </div>
  )
}
