import type { CSSProperties } from 'react'
import { CardFrame, Skeleton, SkeletonBlock, StateRow, Tag, TextLink } from '../../parts'
import rows from '../../styles/rows.module.css'
import type { PieceRenderProps } from '../../types'
import { StatusRow } from '../StatusList/Row'
import { CHECK_WORDS, type ChecklistItem, type ChecklistProps } from './schema'
import styles from './Checklist.module.css'

/** How many checks passed, of how many, and the share the ring draws. */
export function tally(items: readonly ChecklistItem[]) {
  const passed = items.filter(i => i.passed).length
  return { passed, total: items.length, share: items.length ? passed / items.length : 0 }
}

function SkeletonBody() {
  return (
    <div aria-hidden="true">
      <div className={styles.summary}>
        <SkeletonBlock width="var(--metric-size)" height="var(--metric-size)" round />
        <Skeleton text="metric" size="var(--metric-size)" width="9rem" />
      </div>
      <ul className={rows.list}>
        {['42%', '56%', '38%'].map(w => (
          <li key={w} className={rows.item}>
            <div className={rows.row}>
              <SkeletonBlock width="var(--mark)" height="var(--mark)" round className={rows.mark} />
              <span className={rows.text}>
                <Skeleton text="row-title" width={w} />
                <Skeleton text="meta" width="30%" />
              </span>
              <SkeletonBlock width="var(--space-8)" height="calc(var(--text-tag-size) * var(--text-tag-leading) + var(--tag-y) * 2)" className={styles.pill} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Checklist({ props, state, error, warming, onAsk, onRetry }: PieceRenderProps<ChecklistProps>) {
  const { title, meta, source, items, emptyMeta } = props
  const words = CHECK_WORDS[source]
  const isEmpty = state === 'empty' || (state === 'default' && items.length === 0)
  const { passed, total, share } = tally(items)

  return (
    <CardFrame
      title={state === 'skeleton' ? <Skeleton text="card-title" width="9rem" /> : title}
      meta={state === 'skeleton' ? <Skeleton text="meta" width="6rem" /> : meta}
      busy={state === 'skeleton' || state === 'warming'}
      progress={state === 'warming' ? warming?.progress : undefined}
      ariaLabel={state === 'skeleton' ? `Loading ${title}` : undefined}
    >
      {state === 'skeleton' && (
        <>
          <SkeletonBody />
          <span className="sr-only">Loading {title}.</span>
        </>
      )}
      {state === 'default' && !isEmpty && (
        <>
          <div className={styles.summary} data-summary="">
            <span className={styles.ring} data-ring="" style={{ '--share': share } as CSSProperties} aria-hidden="true" />
            <span className={styles.figure}>
              <span data-number="">{passed}</span>
              <small className={styles.suffix}>of {total}</small>
              <span className={styles.caption}>{words.caption}</span>
            </span>
          </div>
          <ul className={rows.list}>
            {items.map(item => (
              <StatusRow
                key={item.id}
                id={item.id}
                mark={item.passed ? 'good' : 'neutral'}
                title={item.title}
                meta={item.meta}
                ask={item.ask}
                onAsk={onAsk}
                url={item.url}
              >
                <Tag tone={item.passed ? 'good' : 'quiet'}>{item.passed ? words.yes : words.no}</Tag>
              </StatusRow>
            ))}
          </ul>
        </>
      )}
      {isEmpty && <StateRow kind="empty" emptyTone="neutral" title={words.empty} meta={emptyMeta} />}
      {state === 'error' && (
        <StateRow
          kind="error"
          title={error?.failed ?? `Couldn't load ${title.toLowerCase()}`}
          meta={error?.cause}
          action={onRetry && <TextLink onClick={onRetry}>Try again</TextLink>}
        />
      )}
      {/* Omitted in the spec; drawn anyway so a stray warming state never leaves a blank card. */}
      {state === 'warming' && <StateRow kind="warming" title={warming?.counting} meta={warming?.nextCheck} />}
    </CardFrame>
  )
}
