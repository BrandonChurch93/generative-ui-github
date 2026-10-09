import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { createLogger } from '@genui-github/core'
import { Skeleton, TextLink } from '../../parts'
import type { PieceRenderProps } from '../../types'
import { NUMBER_MISMATCH_SENTENCE, validateNumbers } from '../../validate/numbers'
import type { InsightProps } from './schema'
import styles from './Insight.module.css'

const log = createLogger('ui:insight')

/** Backticks mark identifiers, which set in mono. Nothing else in the sentence is formatted. */
function withIdentifiers(sentence: string): ReactNode[] {
  return sentence.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
      <code key={i} className={styles.ident}>
        {part.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

/** Returns the sentence to show: the model's, or the system sentence when its numbers do not match its sources. */
export function checkedSentence(props: InsightProps): { sentence: string; replaced: boolean } {
  if (!props.sourceMap) return { sentence: props.sentence, replaced: false }
  const numbers = props.sources.flatMap(s => props.sourceMap?.[s.key]?.numbers ?? [])
  const check = validateNumbers(props.sentence, numbers)
  if (check.ok) return { sentence: props.sentence, replaced: false }
  log.warn('insight numbers did not match their sources', {
    mismatches: check.mismatches.map(m => m.raw),
    sources: props.sources.map(s => s.key),
  })
  return { sentence: NUMBER_MISMATCH_SENTENCE, replaced: true }
}

export function Insight({ props, state, error, warming, onAsk, onRetry }: PieceRenderProps<InsightProps>) {
  const { sentence, replaced } = checkedSentence(props)
  const quiet = state === 'empty' || state === 'error' || props.tone === 'neutral' || replaced

  const sourceLine = () => {
    const parts: ReactNode[] = props.sources.map(source => {
      const words = props.sourceMap?.[source.key]?.words ?? source.key
      return source.ask && onAsk ? (
        <button key={source.key} type="button" className={styles.chip} onClick={() => onAsk(source.ask!)}>
          {words}
        </button>
      ) : (
        <span key={source.key}>{words}</span>
      )
    })
    return (
      <>
        from{' '}
        {parts.map((part, i) => (
          <Fragment key={i}>
            {i > 0 && ', '}
            {part}
          </Fragment>
        ))}
        {props.facts?.map(fact => ` · ${fact}`)}
      </>
    )
  }

  if (state === 'skeleton') {
    return (
      <div className={styles.insight} data-piece="Insight" data-state="skeleton" aria-busy="true">
        <div className={styles.text}>
          <Skeleton text="insight" size="var(--insight-size)" width="90%" />
          <Skeleton text="insight" size="var(--insight-size)" width="60%" />
          <Skeleton text="meta" width="40%" className={styles.sourceSkeleton} />
          <span className="sr-only">Writing the answer.</span>
        </div>
      </div>
    )
  }

  const rule =
    state === 'warming' ? (
      <span className={styles.track} aria-hidden="true">
        <span
          className={styles.rule}
          data-rule=""
          style={{ '--progress': Math.min(1, Math.max(0, warming?.progress ?? 0)) } as CSSProperties}
        />
      </span>
    ) : (
      <span className={styles.rule} data-rule="" data-quiet={quiet || undefined} aria-hidden="true" />
    )

  return (
    <div className={styles.insight} data-piece="Insight" data-state={state} aria-busy={state === 'warming' || undefined}>
      {rule}
      <div className={styles.text}>
        {state === 'error' ? (
          <>
            <p className={styles.sentence} data-sentence="">
              {error?.failed ?? "Couldn't write an answer to this question."}
            </p>
            <p className={styles.source}>
              <span>{error?.cause}</span>
              {onRetry && (
                <TextLink size="hint" onClick={onRetry}>
                  Try again
                </TextLink>
              )}
            </p>
          </>
        ) : state === 'warming' ? (
          <>
            <p className={styles.sentence} data-sentence="" data-quiet="">
              {warming?.counting}
            </p>
            <p className={styles.source}>{warming?.nextCheck}</p>
          </>
        ) : (
          <>
            <p className={styles.sentence} data-sentence="">
              {withIdentifiers(sentence)}
            </p>
            <p className={styles.source} data-source="">
              {sourceLine()}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
