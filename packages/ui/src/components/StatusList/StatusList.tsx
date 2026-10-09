import { CardFrame, Skeleton, SkeletonBlock, StateRow, Tag, TextLink, type MarkKind, type TagTone } from '../../parts'
import { cx } from '../../parts/cx'
import rows from '../../styles/rows.module.css'
import type { PieceRenderProps } from '../../types'
import { Sparkline } from '../Sparkline/Sparkline'
import { StatusRow } from './Row'
import { tagFor, type StatusItem, type StatusKind, type StatusListProps, type StatusValue } from './schema'
import styles from './StatusList.module.css'

const MARK_FOR_TONE: Record<TagTone, MarkKind> = { good: 'good', warn: 'warn', crit: 'crit', quiet: 'neutral' }

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const tenth = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

function Value({ kind, item }: { kind: StatusKind; item: StatusItem }) {
  const value = item.value
  if (!value) return null
  switch (kind) {
    case 'pull': {
      const { add, del } = value as StatusValue['pull']
      return (
        <span className={styles.size}>
          <span aria-hidden="true" className={styles.sizeFigures}>
            <span data-zero={add === 0 || undefined} className={styles.add}>
              +{whole.format(add)}
            </span>
            <span data-zero={del === 0 || undefined} className={styles.del}>
              {'−'}
              {whole.format(del)}
            </span>
          </span>
          <span className="sr-only">
            {whole.format(add)} lines added, {whole.format(del)} removed
          </span>
        </span>
      )
    }
    case 'issue': {
      const { comments } = value as StatusValue['issue']
      return <span className={styles.count}>{`${whole.format(comments)} ${comments === 1 ? 'comment' : 'comments'}`}</span>
    }
    case 'workflow': {
      const { p50Min } = value as StatusValue['workflow']
      return (
        <>
          {item.trend && <Sparkline placement="row" points={item.trend} finding={`Median run over 12 weeks, now ${tenth.format(p50Min)} minutes`} />}
          <span className={styles.value}>{tenth.format(p50Min)} min</span>
        </>
      )
    }
    case 'check': {
      const { durationMin } = value as StatusValue['check']
      return <span className={styles.value}>{tenth.format(durationMin)} min</span>
    }
  }
}

function SkeletonRows() {
  return (
    <ul className={rows.list} aria-hidden="true">
      {['62%', '48%', '70%'].map(w => (
        <li key={w} className={rows.item}>
          <div className={rows.row}>
            <SkeletonBlock width="var(--mark)" height="var(--mark)" round className={rows.mark} />
            <span className={rows.text}>
              <Skeleton text="row-title" width={w} />
              <Skeleton text="meta" width="40%" />
            </span>
            <SkeletonBlock width="calc(var(--space-8) + var(--space-6))" height="calc(var(--text-tag-size) * var(--text-tag-leading) + var(--tag-y) * 2)" className={styles.pill} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function StatusList({ props, state, error, warming, onAsk, onRetry }: PieceRenderProps<StatusListProps>) {
  const { kind, title, meta, items, emptyTone, empty, emptyMeta } = props
  const isEmpty = state === 'empty' || (state === 'default' && items.length === 0)

  return (
    <CardFrame
      title={state === 'skeleton' ? <Skeleton text="card-title" width="10rem" /> : title}
      meta={state === 'skeleton' ? <Skeleton text="meta" width="5rem" /> : meta}
      busy={state === 'skeleton' || state === 'warming'}
      progress={state === 'warming' ? warming?.progress : undefined}
      ariaLabel={state === 'skeleton' ? `Loading ${title}` : undefined}
    >
      {state === 'skeleton' && (
        <>
          <SkeletonRows />
          <span className="sr-only">Loading {title}.</span>
        </>
      )}
      {state === 'default' && !isEmpty && (
        <ul className={cx(rows.list, rows.wrap)}>
          {items.map(item => {
            const tag = tagFor(kind, item.state)
            return (
              <StatusRow
                key={item.id}
                id={item.id}
                mark={tag ? MARK_FOR_TONE[tag.tone] : 'neutral'}
                title={item.title}
                meta={item.meta}
                ask={item.ask}
                onAsk={onAsk}
                url={item.url}
                name={item.title}
              >
                <Value kind={kind} item={item} />
                {tag && <Tag tone={tag.tone}>{tag.words}</Tag>}
              </StatusRow>
            )
          })}
        </ul>
      )}
      {isEmpty && <StateRow kind="empty" emptyTone={emptyTone ?? 'neutral'} title={empty ?? 'Nothing here yet'} meta={emptyMeta} />}
      {state === 'error' && (
        <StateRow
          kind="error"
          title={error?.failed ?? `Couldn't load ${title.toLowerCase()}`}
          meta={error?.cause}
          action={onRetry && <TextLink onClick={onRetry}>Try again</TextLink>}
        />
      )}
      {state === 'warming' && <StateRow kind="warming" title={warming?.counting} meta={warming?.nextCheck} />}
    </CardFrame>
  )
}
