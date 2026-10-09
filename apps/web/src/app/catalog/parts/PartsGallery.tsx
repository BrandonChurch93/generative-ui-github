'use client'

import { useState } from 'react'
import {
  CardFrame,
  Mark,
  MARK_KINDS,
  RepoChip,
  Segmented,
  Skeleton,
  SkeletonBlock,
  Spine,
  StateRow,
  Tag,
  TextLink,
  type Density,
} from '@genui-github/ui'
import rows from '@genui-github/ui/rows.module.css'
import styles from './parts.module.css'

const ROWS = [
  { title: 'Fix hydration warning in app router', meta: '#71204 · huozhi · 2h ago', tag: <Tag tone="good">Approved</Tag> },
  { title: 'Bump turbopack to the next canary', meta: '#71198 · ijjk · 5h ago', tag: <Tag tone="warn">Review pending</Tag> },
  { title: 'Document the new cache options', meta: '#71187 · leerob · 1d ago', tag: <Tag tone="crit">Changes requested</Tag> },
]

// The first and last nodes sit this far from the host's edges: host padding, row padding, half a title line.
const NODE_CENTER = 'calc(var(--row-y) + var(--space-2) + var(--text-row-title-size) * var(--text-row-title-leading) / 2)'

export function PartsGallery() {
  const [density, setDensity] = useState<Density>('comfortable')
  return (
    <div className={styles.gallery} data-density={density}>
      <Segmented
        label="Density"
        value={density}
        onChange={setDensity}
        options={[
          { value: 'compact', label: 'Compact' },
          { value: 'comfortable', label: 'Comfortable' },
          { value: 'spacious', label: 'Spacious' },
        ]}
      />

      <CardFrame title="Mark" meta="10px · decorative, the words carry the state">
        <ul className={styles.marks}>
          {MARK_KINDS.map(kind => (
            <li key={kind}>
              <Mark kind={kind} />
              <span>{kind}</span>
            </li>
          ))}
        </ul>
      </CardFrame>

      <CardFrame title="Tag" meta="text on a 10% tint of itself">
        <p className={styles.inline}>
          <Tag tone="good">Approved</Tag>
          <Tag tone="warn">Review pending</Tag>
          <Tag tone="crit">Failing</Tag>
          <Tag tone="quiet">Cached</Tag>
        </p>
      </CardFrame>

      <CardFrame title="TextLink and RepoChip" meta="accent-text · 36px hit area" headerEnd={<TextLink href="#parts-title">Source</TextLink>}>
        <p className={styles.inline}>
          <TextLink onClick={() => undefined}>Try again</TextLink>
          <TextLink href="#rows">Show all</TextLink>
          <RepoChip repo="vercel/next.js" href="#rows" selected />
          <RepoChip repo="facebook/react" href="#rows" />
          <RepoChip repo="vitejs/vite" />
        </p>
      </CardFrame>

      <CardFrame title="Rows" meta="one hover, one focus ring">
        <ul className={rows.list} id="rows">
          {ROWS.map(row => (
            <li key={row.title} className={rows.item}>
              <a className={rows.row} href="#rows">
                <Mark kind={row.tag.props.tone === 'crit' ? 'crit' : row.tag.props.tone === 'warn' ? 'warn' : 'good'} className={styles.rowMark} />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{row.title}</span>
                  <span className={styles.rowMeta}>{row.meta}</span>
                </span>
                {row.tag}
              </a>
            </li>
          ))}
        </ul>
      </CardFrame>

      <CardFrame title="StateRow" meta="empty · error · warming">
        <StateRow kind="empty" title="Nothing merged into v17.0 yet" meta="since Oct 1" />
        <StateRow kind="empty" emptyTone="good" title="No reverts in the last 14 days" />
        <StateRow
          kind="error"
          title="Couldn't load pull requests"
          meta="GitHub returned 502"
          action={<TextLink onClick={() => undefined}>Try again</TextLink>}
        />
        <StateRow kind="warming" title="GitHub is counting contributors" meta="checking again in 4s" />
      </CardFrame>

      <CardFrame title="Skeleton" meta="line heights held" busy>
        <div className={styles.skeleton}>
          <Skeleton text="row-title" width="70%" />
          <Skeleton text="meta" width="45%" />
          <SkeletonBlock width="100%" height="var(--space-2)" />
        </div>
      </CardFrame>

      <CardFrame title="Spine" meta="Timeline and Steps">
        <div className={styles.spineHost}>
          <Spine top={NODE_CENTER} bottom={NODE_CENTER} />
          {['Today', 'Yesterday', 'Fri Oct 2'].map((day, i) => (
            <p key={day} className={styles.spineRow}>
              <Mark kind={i === 0 ? 'endpoint' : 'node'} />
              {day}
            </p>
          ))}
        </div>
      </CardFrame>

      <CardFrame title="CardFrame" meta="hot · warming bar" hot progress={0.6}>
        <p className={styles.frameNote}>The frame renders in every state.</p>
      </CardFrame>
    </div>
  )
}
