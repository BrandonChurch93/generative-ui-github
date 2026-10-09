import { CardFrame, cx, Skeleton, SkeletonBlock, StateRow, TextLink } from '../../parts'
import rows from '../../styles/rows.module.css'
import type { PieceRenderProps } from '../../types'
import { StatusRow } from '../StatusList/Row'
import { relativeTime } from '../Timeline/days'
import { ACTIVITY_COPY, VERB_WORDS, type ActivityEvent, type ActivityFeedProps } from './schema'
import styles from './ActivityFeed.module.css'

const SKELETON_ROWS = [
  { handle: '3.5rem', title: '58%', meta: '30%' },
  { handle: '2.75rem', title: '66%', meta: '24%' },
  { handle: '4rem', title: '50%', meta: '34%' },
]

function Event({ event, newest, now, onAsk }: { event: ActivityEvent; newest: boolean; now: string; onAsk?: (ask: string) => void }) {
  return (
    <StatusRow
      id={event.id}
      mark={newest ? 'endpoint' : 'node'}
      className={styles.item}
      title={
        <>
          <span className={styles.actor}>{event.actor}</span> <span className={styles.verb}>{VERB_WORDS[event.verb]}</span>{' '}
          <span className={styles.object}>{event.object.title}</span>
        </>
      }
      meta={
        <>
          {event.object.ref !== event.object.title && `${event.object.ref} · `}
          <time dateTime={event.when}>{relativeTime(event.when, now)}</time>
        </>
      }
      ask={event.ask}
      onAsk={onAsk}
      url={event.url}
    />
  )
}

function SkeletonRows() {
  return (
    <ol className={rows.list} aria-hidden="true">
      {SKELETON_ROWS.map(s => (
        <li key={s.title} className={rows.item}>
          <div className={rows.row}>
            <span className={cx(rows.mark, styles.skeletonMark)}>
              <SkeletonBlock width="var(--node)" height="var(--node)" round />
            </span>
            <span className={rows.text}>
              <span className={styles.skeletonLine}>
                <Skeleton text="handle" width={s.handle} />
                <Skeleton text="row-title" width={s.title} />
              </span>
              <Skeleton text="meta" width={s.meta} />
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function ActivityFeed({ props, state, error, onAsk, onRetry }: PieceRenderProps<ActivityFeedProps>) {
  const { meta, items, now, empty, emptyMeta, emptyTone } = props
  const title = props.title ?? ACTIVITY_COPY.title
  // Warming cannot happen here (see the spec); a stray one waits like a skeleton rather than claiming a 202.
  const skeleton = state === 'skeleton' || state === 'warming'
  const isEmpty = state === 'empty' || (state === 'default' && items.length === 0)

  return (
    <CardFrame
      title={skeleton ? <Skeleton text="card-title" width="8rem" /> : title}
      meta={skeleton ? <Skeleton text="meta" width="5rem" /> : meta}
      busy={skeleton}
      ariaLabel={skeleton ? `Loading ${title}` : undefined}
    >
      {skeleton && (
        <>
          <SkeletonRows />
          <span className="sr-only">Loading {ACTIVITY_COPY.loading}.</span>
        </>
      )}
      {state === 'default' && !isEmpty && (
        <ol className={rows.list}>
          {items.map((event, i) => (
            <Event key={event.id} event={event} newest={i === 0} now={now} onAsk={onAsk} />
          ))}
        </ol>
      )}
      {isEmpty && <StateRow kind="empty" emptyTone={emptyTone ?? 'neutral'} title={empty ?? ACTIVITY_COPY.empty} meta={emptyMeta} />}
      {state === 'error' && (
        <StateRow
          kind="error"
          title={error?.failed ?? ACTIVITY_COPY.failed}
          meta={error?.cause}
          action={onRetry && <TextLink onClick={onRetry}>Try again</TextLink>}
        />
      )}
    </CardFrame>
  )
}
