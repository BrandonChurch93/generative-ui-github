import type { ReactNode } from 'react'
import rows from '../../styles/rows.module.css'

/** A plain list in the row rhythm: hairlines between items, no marks, no tags. */
export function List({ items, ordered }: { items: { id: string; title: ReactNode; meta?: ReactNode }[]; ordered?: boolean }) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag className={rows.list} data-piece="List">
      {items.map(item => (
        <li key={item.id} className={rows.item} data-row={item.id}>
          <span className={rows.hairline} aria-hidden="true" />
          <div className={rows.row}>
            <span className={rows.text}>
              <span className={rows.title}>{item.title}</span>
              {item.meta !== undefined && <span className={rows.meta}>{item.meta}</span>}
            </span>
          </div>
        </li>
      ))}
    </Tag>
  )
}
