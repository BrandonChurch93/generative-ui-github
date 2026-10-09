import { CardFrame, cx, Skeleton, SkeletonBlock, StateRow, TextLink } from '../../parts'
import rows from '../../styles/rows.module.css'
import type { PieceRenderProps } from '../../types'
import { Avatar } from '../Avatar/Avatar'
import { DEFAULT_PERSON_LIMIT, PERSON_WORDS, type ListedPerson, type PersonListProps, type PersonMeasure } from './schema'
import styles from './PersonList.module.css'

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** "268 commits", "1 review". The system's one fact per person. */
export function factWords(count: number, measure: PersonMeasure): string {
  const words = PERSON_WORDS[measure]
  return `${whole.format(count)} ${count === 1 ? words.one : words.many}`
}

const SKELETON_ROWS = [
  { handle: '4rem', name: '5rem' },
  { handle: '3rem', name: '6rem' },
  { handle: '3.5rem', name: '4rem' },
]

function Row({ person, measure, onAsk }: { person: ListedPerson; measure: PersonMeasure; onAsk?: (ask: string) => void }) {
  const words = PERSON_WORDS[measure]
  const body = (
    <>
      <Avatar handle={person.handle} />
      <span className={styles.id} aria-hidden="true">
        <b className={styles.handle}>{person.handle}</b>
        {person.name && <span className={styles.name}>{person.name}</span>}
      </span>
      <span className={styles.fact} aria-hidden="true">
        <span className={styles.count} data-count="">
          {whole.format(person.count)}
        </span>
        <span className={styles.unit}>{person.count === 1 ? words.one : words.many}</span>
      </span>
      <span className="sr-only">{[person.handle, person.name, factWords(person.count, measure)].filter(Boolean).join(', ')}</span>
    </>
  )
  let row
  if (person.ask !== undefined && onAsk) {
    row = (
      <button type="button" className={cx(rows.row, styles.row)} onClick={() => onAsk(person.ask!)}>
        {body}
      </button>
    )
  } else if (person.url) {
    row = (
      <a className={cx(rows.row, styles.row)} href={person.url} target="_blank" rel="noreferrer">
        {body}
      </a>
    )
  } else {
    row = <div className={cx(rows.row, styles.row)}>{body}</div>
  }
  return (
    <li className={cx(rows.item, styles.item)} data-row={person.handle} data-flip-id={`person-${person.handle}`}>
      <span className={cx(rows.hairline, styles.hairline)} data-hairline="" aria-hidden="true" />
      {row}
    </li>
  )
}

function SkeletonRows() {
  return (
    <ol className={rows.list} aria-hidden="true">
      {SKELETON_ROWS.map(s => (
        <li key={s.handle} className={rows.item}>
          <div className={cx(rows.row, styles.row)}>
            <SkeletonBlock width="calc(var(--space-5) + var(--space-1))" height="calc(var(--space-5) + var(--space-1))" round />
            <span className={styles.id}>
              <Skeleton text="handle" width={s.handle} />
              <Skeleton text="label" width={s.name} />
            </span>
            <span className={styles.fact}>
              <Skeleton text="value" width="3.5rem" />
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function PersonList({ props, state, error, warming, onAsk, onRetry }: PieceRenderProps<PersonListProps>) {
  const { measure, meta, people, empty, emptyMeta, emptyTone } = props
  const words = PERSON_WORDS[measure]
  const title = props.title ?? words.title
  const shown = people.slice(0, props.limit ?? DEFAULT_PERSON_LIMIT)
  const skeleton = state === 'skeleton'
  const isEmpty = state === 'empty' || (state === 'default' && shown.length === 0)

  return (
    <CardFrame
      title={skeleton ? <Skeleton text="card-title" width="8rem" /> : title}
      meta={skeleton ? <Skeleton text="meta" width="5rem" /> : meta}
      busy={skeleton || state === 'warming'}
      progress={state === 'warming' ? warming?.progress : undefined}
      ariaLabel={skeleton ? `Loading ${words.loading}` : undefined}
    >
      {skeleton && (
        <>
          <SkeletonRows />
          <span className="sr-only">Loading {words.loading}.</span>
        </>
      )}
      {state === 'default' && !isEmpty && (
        <ol className={rows.list}>
          {shown.map(person => (
            <Row key={person.handle} person={person} measure={measure} onAsk={onAsk} />
          ))}
        </ol>
      )}
      {isEmpty && <StateRow kind="empty" emptyTone={emptyTone ?? 'neutral'} title={empty ?? words.empty} meta={emptyMeta} />}
      {state === 'error' && (
        <StateRow
          kind="error"
          title={error?.failed ?? `Couldn't load ${words.loading}`}
          meta={error?.cause}
          action={onRetry && <TextLink onClick={onRetry}>Try again</TextLink>}
        />
      )}
      {state === 'warming' && (
        <StateRow kind="warming" title={warming?.counting ?? words.warming ?? PERSON_WORDS.commits.warming} meta={warming?.nextCheck} />
      )}
    </CardFrame>
  )
}
