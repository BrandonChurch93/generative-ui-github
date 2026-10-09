import type { CSSProperties } from 'react'
import { CardFrame, cx, Mark, Skeleton, SkeletonBlock, StateRow, Tag, TextLink } from '../../parts'
import rows from '../../styles/rows.module.css'
import type { PieceRenderProps } from '../../types'
import { countWords, formatCount, rankPeople, type Ranking, type RankRow } from './rank'
import { RANK_COPY, RANK_WINDOW_WORDS, RANK_WORDS, type ContributorRankProps, type RankMeasure } from './schema'
import styles from './ContributorRank.module.css'

/** Descending, so the ranking reads before the names land. Widths follow the reference skeleton. */
const SKELETON_ROWS = [
  { handle: '3.5rem', name: '5.25rem', count: '1.5rem', share: '1.75rem', bar: '100%' },
  { handle: '4.5rem', name: '4rem', count: '1.5rem', share: '1.75rem', bar: '66%' },
  { handle: '3rem', name: '6rem', count: '1rem', share: '1.25rem', bar: '41%' },
]

/** The bar flips its tooltip before its end past this share of the width, so the tip stays on the card. */
const TIP_FLIP = 0.6

function headerMeta(props: ContributorRankProps, ranking: Ranking | null): string {
  const parts = [props.meta]
  if (!props.meta?.includes(RANK_WINDOW_WORDS)) parts.push(RANK_WINDOW_WORDS)
  if (ranking) parts.push(countWords(ranking.total, props.measure, true))
  return parts.filter(Boolean).join(' · ')
}

function Row({ row, measure, onAsk }: { row: RankRow; measure: RankMeasure; onAsk?: (ask: string) => void }) {
  const words = RANK_WORDS[measure]
  const body = (
    <>
      <span className={styles.line} aria-hidden="true">
        <span className={styles.id}>
          <b className={styles.handle}>{row.handle}</b>
          {row.name && <span className={styles.name}>{row.name}</span>}
        </span>
        <span className={styles.count} data-count="">
          {formatCount(row.count)}
        </span>
        <span className={styles.share} data-share="">
          {row.percent}%
        </span>
      </span>
      <span className="sr-only">{[row.handle, row.name, countWords(row.count, measure), `${row.percent}%`].filter(Boolean).join(', ')}</span>
      <span className={styles.track} data-track="" aria-hidden="true" />
      <span className={styles.bar} data-bar="" data-wall={row.wall || undefined} aria-hidden="true" />
    </>
  )
  const interactive = row.ask !== undefined && onAsk !== undefined
  return (
    <li
      className={cx(rows.item, styles.item)}
      data-row={row.handle}
      data-flip-id={`rank-${row.handle}`}
      data-side={row.frac > TIP_FLIP ? 'before' : 'after'}
      style={{ '--frac': row.frac } as CSSProperties}
    >
      <span className={cx(rows.hairline, styles.hairline)} data-hairline="" aria-hidden="true" />
      {interactive ? (
        <button type="button" className={cx(rows.row, styles.row)} onClick={() => onAsk(row.ask!)}>
          {body}
        </button>
      ) : (
        <div className={cx(rows.row, styles.row)}>{body}</div>
      )}
      <span className={styles.tip} aria-hidden="true" data-tip="">
        <i className={styles.tipKey} data-wall={row.wall || undefined} />
        <b className={styles.tipValue}>
          {formatCount(row.count)} <span className={styles.tipUnit}>{row.count === 1 ? words.shortOne : words.short}</span>
        </b>
        {row.lastWords && <em className={styles.tipLast}>{row.lastWords}</em>}
      </span>
    </li>
  )
}

function Band({ ranking }: { ranking: Ranking }) {
  return (
    <div className={styles.band} data-band="" data-flip-id="rank-band">
      <span className={styles.keySlot} data-band-key="" aria-hidden="true">
        {ranking.risk ? <Mark kind="warn" /> : <span className={styles.key} data-ref={ranking.walled ? undefined : ''} />}
      </span>
      <p className={styles.bandText} data-band-text="">
        <b>{ranking.band.label}</b> · {ranking.band.sentence}
      </p>
      <span className={styles.rule} data-band-rule="" aria-hidden="true" />
      {ranking.risk && (
        <span className={styles.riskTag} data-band-tag="">
          <Tag tone="warn">{RANK_COPY.risk}</Tag>
        </span>
      )}
    </div>
  )
}

function TableView({ ranking, props }: { ranking: Ranking; props: ContributorRankProps }) {
  const words = RANK_WORDS[props.measure]
  return (
    <table className="sr-only" data-table-view="">
      <caption>{props.title}</caption>
      <thead>
        <tr>
          <th scope="col">Person</th>
          <th scope="col">{words.column}</th>
          <th scope="col">Share</th>
          <th scope="col">Running total</th>
        </tr>
      </thead>
      <tbody>
        {ranking.rows.map(r => (
          <tr key={r.handle}>
            <th scope="row">{r.name ? `${r.handle} (${r.name})` : r.handle}</th>
            <td>{formatCount(r.count)}</td>
            <td>{r.percent}%</td>
            <td>{r.running}%</td>
          </tr>
        ))}
        {ranking.rest && (
          <tr>
            <th scope="row">
              {ranking.rest.people} more {words.people}
            </th>
            <td>{formatCount(ranking.rest.count)}</td>
            <td>{ranking.rest.percent}%</td>
            <td>100%</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

function SkeletonRows() {
  return (
    <ol className={cx(rows.list, styles.skeleton)} aria-hidden="true">
      {SKELETON_ROWS.map(s => (
        <li key={s.bar} className={rows.item}>
          <div className={cx(rows.row, styles.row)}>
            <span className={styles.line}>
              <span className={styles.id}>
                <Skeleton text="handle" width={s.handle} />
                <Skeleton text="label" width={s.name} />
              </span>
              <span className={styles.count}>
                <Skeleton text="meta" width={s.count} />
              </span>
              <span className={styles.share}>
                <Skeleton text="value" width={s.share} />
              </span>
            </span>
            <SkeletonBlock width={s.bar} height="var(--space-2)" className={styles.skeletonBar} />
          </div>
        </li>
      ))}
    </ol>
  )
}

export function ContributorRank({ props, state, error, warming, onAsk, onRetry }: PieceRenderProps<ContributorRankProps>) {
  const words = RANK_WORDS[props.measure]
  const ranking = state === 'default' ? rankPeople(props) : null
  const isEmpty = state === 'empty' || (ranking !== null && ranking.rows.length === 0)
  const live = ranking !== null && !isEmpty
  const skeleton = state === 'skeleton'

  return (
    <CardFrame
      className={styles.root}
      title={skeleton ? <Skeleton text="card-title" width="10.5rem" /> : props.title}
      meta={skeleton ? <Skeleton text="meta" width="8rem" /> : headerMeta(props, live ? ranking : null)}
      busy={skeleton || state === 'warming'}
      progress={state === 'warming' ? warming?.progress : undefined}
      ariaLabel={live ? ranking.finding : skeleton ? `Loading ${words.loading}` : undefined}
    >
      {skeleton && (
        <>
          <SkeletonRows />
          <span className="sr-only">Loading {words.loading}.</span>
        </>
      )}
      {live && (
        <>
          <ol className={cx(rows.list, styles.list)}>
            {ranking.rows.slice(0, ranking.above).map(r => (
              <Row key={r.handle} row={r} measure={props.measure} onAsk={onAsk} />
            ))}
          </ol>
          <Band ranking={ranking} />
          {ranking.above < ranking.rows.length && (
            <ol className={cx(rows.list, styles.list)} start={ranking.above + 1}>
              {ranking.rows.slice(ranking.above).map(r => (
                <Row key={r.handle} row={r} measure={props.measure} onAsk={onAsk} />
              ))}
            </ol>
          )}
          {ranking.rest && (
            <p className={styles.foot} data-foot="">
              {ranking.rest.words}
            </p>
          )}
          <TableView ranking={ranking} props={props} />
        </>
      )}
      {isEmpty && <StateRow kind="empty" emptyTone={props.emptyTone ?? 'neutral'} title={props.empty ?? RANK_COPY.empty} meta={props.emptyMeta} />}
      {state === 'error' && (
        <StateRow
          kind="error"
          title={error?.failed ?? `Couldn't load ${words.loading}`}
          meta={error?.cause}
          action={onRetry && <TextLink onClick={onRetry}>Try again</TextLink>}
        />
      )}
      {state === 'warming' && <StateRow kind="warming" title={warming?.counting ?? RANK_COPY.warming} meta={warming?.nextCheck} />}
    </CardFrame>
  )
}
