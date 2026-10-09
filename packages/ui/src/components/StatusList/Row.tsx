import type { ReactNode } from 'react'
import { Mark, type MarkKind } from '../../parts'
import { cx } from '../../parts/cx'
import rows from '../../styles/rows.module.css'

export interface StatusRowProps {
  id: string
  mark: MarkKind
  title: ReactNode
  meta?: ReactNode
  /** Size, value, tag: whatever sits on the right of the row. */
  children?: ReactNode
  /** With `onAsk`, the row is a button that asks this question. */
  ask?: string
  onAsk?: (ask: string) => void
  /** Otherwise, a link out (a pull request on GitHub). */
  url?: string
  className?: string
}

/** The row every list shares: mark, title, meta, then what sits on the right. A part, never picked. */
export function StatusRow({ id, mark, title, meta, children, ask, onAsk, url, className }: StatusRowProps) {
  const body = (
    <>
      <Mark kind={mark} className={rows.mark} />
      <span className={rows.text}>
        <span className={rows.title}>{title}</span>
        {meta !== undefined && <span className={rows.meta}>{meta}</span>}
      </span>
      {children}
    </>
  )
  let row: ReactNode
  if (ask !== undefined && onAsk) {
    row = (
      <button type="button" className={rows.row} onClick={() => onAsk(ask)}>
        {body}
      </button>
    )
  } else if (url) {
    row = (
      <a className={rows.row} href={url} target="_blank" rel="noreferrer">
        {body}
      </a>
    )
  } else {
    row = <div className={rows.row}>{body}</div>
  }
  return (
    <li className={cx(rows.item, className)} data-row={id}>
      <span className={rows.hairline} data-hairline="" aria-hidden="true" />
      {row}
    </li>
  )
}
