import { CardFrame, Skeleton, StateRow, TextLink } from '../../parts'
import type { PieceRenderProps } from '../../types'
import type { ProbeProps } from './spec'
import styles from './Probe.module.css'

export function Probe({ props, state, error, onRetry }: PieceRenderProps<ProbeProps>) {
  return (
    <CardFrame title={props.label} busy={state === 'skeleton'}>
      {state === 'default' && (
        <p className={styles.value}>
          {props.value}
          {props.suffix && <small className={styles.suffix}>{props.suffix}</small>}
        </p>
      )}
      {state === 'skeleton' && (
        <div className={styles.pad}>
          <Skeleton text="metric" width="40%" />
          <span className="sr-only">Loading {props.label}.</span>
        </div>
      )}
      {state === 'empty' && <StateRow kind="empty" title="Nothing to count yet" />}
      {state === 'error' && error && (
        <StateRow
          kind="error"
          title={error.failed}
          meta={error.cause}
          action={onRetry && <TextLink onClick={onRetry}>Try again</TextLink>}
        />
      )}
    </CardFrame>
  )
}
