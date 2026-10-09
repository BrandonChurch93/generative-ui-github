import { CardFrame, Skeleton, StateRow, TextLink } from '../../parts'
import type { PieceRenderProps } from '../../types'
import { relativeTime } from '../Timeline/days'
import { KEY_VALUE_COPY, MAX_PAIRS, type KeyValuePair, type KeyValueProps } from './schema'
import styles from './KeyValue.module.css'

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const tenth = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const day = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })

const SKELETON_ROWS = [
  { label: '5.5rem', value: '4rem' },
  { label: '4rem', value: '6rem' },
  { label: '6rem', value: '3rem' },
  { label: '4.5rem', value: '5rem' },
]

/** The value as the reader sees it. Counts and times are formatted by the system, never by the model. */
function Value({ pair, now }: { pair: KeyValuePair; now?: string }) {
  const { value, kind = 'text' } = pair
  if (kind === 'count' && typeof value === 'number') return <>{Number.isInteger(value) ? whole.format(value) : tenth.format(value)}</>
  if (kind === 'time' && typeof value === 'string') {
    return <time dateTime={value}>{now ? relativeTime(value, now) : day.format(new Date(value))}</time>
  }
  return <>{value}</>
}

export function KeyValue({ props, state, error, ask, onAsk, onRetry }: PieceRenderProps<KeyValueProps>) {
  const { source, meta, pairs, now, empty, emptyMeta, emptyTone } = props
  const copy = KEY_VALUE_COPY[source]
  const title = props.title ?? copy.title
  // Warming cannot happen here (see the spec); a stray one waits like a skeleton rather than claiming a 202.
  const skeleton = state === 'skeleton' || state === 'warming'
  const shown = pairs.slice(0, MAX_PAIRS)
  const isEmpty = state === 'empty' || (state === 'default' && shown.length === 0)
  const live = state === 'default' && !isEmpty
  const interactive = live && ask !== undefined && onAsk !== undefined
  // A button holds phrasing content only, so an asking card keeps the pairs' order in spans.
  const [List, Group, Term, Desc] = interactive ? (['span', 'span', 'span', 'span'] as const) : (['dl', 'div', 'dt', 'dd'] as const)

  return (
    <CardFrame
      title={skeleton ? <Skeleton text="card-title" width="9rem" /> : title}
      meta={skeleton ? <Skeleton text="meta" width="5rem" /> : meta}
      busy={skeleton}
      ariaLabel={skeleton ? `Loading ${copy.loading}` : undefined}
      onClick={interactive ? () => onAsk(ask) : undefined}
    >
      {skeleton && (
        <>
          <div className={styles.list} aria-hidden="true">
            {SKELETON_ROWS.map(s => (
              <div key={s.label} className={styles.pair}>
                <Skeleton text="label" width={s.label} />
                <Skeleton text="value" width={s.value} />
              </div>
            ))}
          </div>
          <span className="sr-only">Loading {copy.loading}.</span>
        </>
      )}
      {live && (
        <List className={styles.list}>
          {shown.map(pair => (
            <Group key={pair.key} className={styles.pair} data-row={pair.key}>
              <Term className={styles.label}>{pair.label}</Term>
              <Desc className={styles.value} data-kind={pair.kind ?? 'text'} data-value="">
                <Value pair={pair} now={now} />
              </Desc>
            </Group>
          ))}
        </List>
      )}
      {isEmpty && <StateRow kind="empty" emptyTone={emptyTone ?? 'neutral'} title={empty ?? copy.empty} meta={emptyMeta} />}
      {state === 'error' && (
        <StateRow
          kind="error"
          title={error?.failed ?? copy.failed}
          meta={error?.cause}
          action={onRetry && <TextLink onClick={onRetry}>Try again</TextLink>}
        />
      )}
    </CardFrame>
  )
}
