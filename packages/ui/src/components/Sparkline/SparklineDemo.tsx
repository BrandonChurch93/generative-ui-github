import { CardFrame } from '../../parts'
import type { PieceRenderProps } from '../../types'
import { Sparkline, type SparklineProps } from './Sparkline'
import styles from './SparklineDemo.module.css'

/** Catalog only: the part in a bare frame, so its own states can be seen without a host. */
export function SparklineDemo({ props, state, warming }: PieceRenderProps<SparklineProps>) {
  return (
    <CardFrame title="Sparkline" meta="part of Metric and list rows" busy={state === 'skeleton'}>
      <div className={styles.row}>
        <Sparkline {...props} state={state} progress={warming?.progress} />
      </div>
    </CardFrame>
  )
}
