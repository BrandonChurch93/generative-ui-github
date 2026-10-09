import { CardFrame, Mark, OutArrow, OutWords, Skeleton, SkeletonBlock, Spine, StateRow, TextLink } from '../../parts'
import type { PieceRenderProps } from '../../types'
import { groupByDay, relativeTime } from './days'
import type { TimelineItem, TimelineProps } from './schema'
import styles from './Timeline.module.css'

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

// From the card's top to the first node's center, and from the last node's center to the card's bottom.
// Rows are fixed at two lines, so these are per-density constants rather than measurements.
const SPINE_TOP =
  'calc(var(--card-y) + var(--space-1) + var(--text-meta-size) * var(--text-meta-leading) + var(--row-y) + var(--text-row-title-size) * var(--text-row-title-leading) / 2)'
const SPINE_BOTTOM =
  'calc(var(--row-y) + var(--space-1) / 2 + var(--text-meta-size) * var(--text-meta-leading) + var(--text-row-title-size) * var(--text-row-title-leading) / 2)'

function Row({ item, newest, now, kind, onAsk }: { item: TimelineItem; newest: boolean; now: string; kind: TimelineProps['kind']; onAsk?: (ask: string) => void }) {
  const out = !(item.ask && onAsk)
  const verb = item.verb ?? (kind === 'merged' ? 'merged' : 'committed')
  const ref = kind === 'merged' ? `#${item.id}` : item.id
  const sized = item.add !== undefined && item.del !== undefined
  const body = (
    <>
      <span className={styles.line}>
        <span className={styles.title}>{item.title}</span>
        {sized && (
          <span className={styles.size} aria-hidden="true">
            <span className={styles.add} data-zero={item.add === 0 || undefined}>
              +{whole.format(item.add!)}
            </span>
            <span className={styles.del} data-zero={item.del === 0 || undefined}>
              {'−'}
              {whole.format(item.del!)}
            </span>
          </span>
        )}
        {out && <OutArrow />}
      </span>
      <span className={styles.meta}>
        {ref} · {item.author} · {verb} <time dateTime={item.when}>{relativeTime(item.when, now)}</time>
      </span>
      {sized && (
        <span className="sr-only">
          {whole.format(item.add!)} lines added, {whole.format(item.del!)} removed
        </span>
      )}
      {out && <OutWords href={item.url} />}
    </>
  )
  return (
    <li className={styles.item} data-row={item.id}>
      <Mark kind={newest ? 'endpoint' : 'node'} className={styles.node} />
      {item.ask && onAsk ? (
        <button type="button" className={styles.row} onClick={() => onAsk(item.ask!)}>
          {body}
        </button>
      ) : (
        <a className={styles.row} href={item.url} target="_blank" rel="noreferrer">
          {body}
        </a>
      )}
    </li>
  )
}

function SkeletonBody() {
  return (
    <div aria-hidden="true">
      <div className={styles.day}>
        <Skeleton text="meta" width="3rem" />
      </div>
      {['68%', '76%', '60%'].map(w => (
        <div key={w} className={styles.skeletonRow}>
          <SkeletonBlock width="var(--node)" height="var(--node)" round className={styles.skeletonNode} />
          <span className={styles.line}>
            <Skeleton text="row-title" width={w} />
            <SkeletonBlock width="3.5rem" height="calc(var(--text-tag-size) * 0.72)" />
          </span>
          <Skeleton text="meta" width="45%" />
        </div>
      ))}
    </div>
  )
}

export function Timeline({ props, state, error, warming, onAsk, onRetry }: PieceRenderProps<TimelineProps>) {
  const { title, meta, items, kind, now, emptyTone, empty, emptyMeta, dayAsk } = props
  const timeZone = props.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const isEmpty = state === 'empty' || (state === 'default' && items.length === 0)
  const days = state === 'default' && !isEmpty ? groupByDay(items, now, timeZone) : []

  return (
    <CardFrame
      title={state === 'skeleton' ? <Skeleton text="card-title" width="9rem" /> : title}
      meta={state === 'skeleton' ? <Skeleton text="meta" width="5rem" /> : meta}
      busy={state === 'skeleton' || state === 'warming'}
      progress={state === 'warming' ? warming?.progress : undefined}
      ariaLabel={state === 'skeleton' ? `Loading ${title}` : undefined}
    >
      {state === 'skeleton' && (
        <>
          <SkeletonBody />
          <span className="sr-only">Loading merged pull requests.</span>
        </>
      )}
      {days.length > 0 && (
        <div className={styles.body}>
          {items.length > 1 && <Spine top={SPINE_TOP} bottom={SPINE_BOTTOM} />}
          {days.map((day, d) => (
            <section key={day.key} aria-label={day.full} data-day="">
              <h3 className={styles.day}>
                {dayAsk && onAsk ? (
                  <button type="button" className={styles.dayButton} onClick={() => onAsk(dayAsk.replaceAll('{day}', day.heading))}>
                    <time dateTime={day.key}>{day.heading}</time>
                  </button>
                ) : (
                  <time dateTime={day.key}>{day.heading}</time>
                )}
              </h3>
              <ol className={styles.list}>
                {day.items.map((item, i) => (
                  <Row key={item.id} item={item} newest={d === 0 && i === 0} now={now} kind={kind} onAsk={onAsk} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
      {isEmpty && <StateRow kind="empty" emptyTone={emptyTone ?? 'neutral'} title={empty ?? 'Nothing here yet'} meta={emptyMeta} />}
      {state === 'error' && (
        <StateRow
          kind="error"
          title={error?.failed ?? "Couldn't load merged pull requests"}
          meta={error?.cause}
          action={onRetry && <TextLink onClick={onRetry}>Try again</TextLink>}
        />
      )}
      {state === 'warming' && <StateRow kind="warming" title={warming?.counting} meta={warming?.nextCheck} />}
    </CardFrame>
  )
}
