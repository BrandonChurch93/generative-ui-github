import { CardFrame, StateRow } from '../../parts'
import type { PieceRenderProps } from '../../types'
import type { EmptyStateProps } from './schema'
import styles from './EmptyState.module.css'

/**
 * A region with nothing in it: the card a list would have filled, holding one empty row in the shared rhythm.
 * It has one face. Every state it is handed renders that face, so a stray state never blanks the region.
 */
export function EmptyState({ props }: PieceRenderProps<EmptyStateProps>) {
  const { title, meta, sentence, detail, emptyTone } = props
  return (
    <CardFrame
      title={title}
      meta={meta}
      ariaLabel={title === undefined ? sentence : undefined}
      className={title === undefined && meta === undefined ? styles.bare : undefined}
    >
      <StateRow kind="empty" emptyTone={emptyTone ?? 'neutral'} title={sentence} meta={detail} />
    </CardFrame>
  )
}
