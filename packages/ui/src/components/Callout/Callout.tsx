import { Fragment, type ReactNode } from 'react'
import { createLogger } from '@genui-github/core'
import { CardFrame, Mark, Skeleton, SkeletonBlock, TextLink, type MarkKind } from '../../parts'
import type { PieceRenderProps } from '../../types'
import { validateNumbers } from '../../validate/numbers'
import { CALLOUT_WORDS, type CalloutProps } from './schema'
import styles from './Callout.module.css'

const log = createLogger('ui:callout')

const MARK_FOR_TONE: Record<CalloutProps['tone'], MarkKind> = { neutral: 'neutral', good: 'good', warn: 'warn', crit: 'crit' }

/** Backticks mark identifiers, which set in mono. Nothing else in the sentence is formatted. */
function withIdentifiers(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
      <code key={i} className={styles.ident}>
        {part.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

/** The sentence to show: the model's, or the system sentence when it cites a figure the data does not hold. */
export function checkedText(props: CalloutProps): { text: string; replaced: boolean } {
  const check = validateNumbers(props.text, props.numbers ?? [])
  if (check.ok) return { text: props.text, replaced: false }
  log.warn('callout figures did not match the data', {
    mismatches: check.mismatches.map(m => m.raw),
    bound: props.numbers?.length ?? 0,
  })
  return { text: CALLOUT_WORDS.mismatch, replaced: true }
}

export function Callout({ props, state, error, ask, onAsk, onRetry }: PieceRenderProps<CalloutProps>) {
  if (state === 'skeleton') {
    return (
      <CardFrame as="div" busy>
        <span className={styles.row}>
          <SkeletonBlock width="var(--mark)" height="var(--mark)" round className={styles.mark} />
          <span className={styles.text}>
            <span className={styles.lines}>
              <Skeleton text="body" size="var(--text-action-size)" width="92%" />
              <Skeleton text="body" size="var(--text-action-size)" width="55%" />
            </span>
            <Skeleton text="meta" width="40%" />
          </span>
        </span>
        <span className="sr-only">{CALLOUT_WORDS.loading}</span>
      </CardFrame>
    )
  }

  if (state === 'error') {
    return (
      <CardFrame as="div">
        <span className={styles.rule} data-rule="" data-tone="quiet" aria-hidden="true" />
        <span className={styles.row}>
          <Mark kind="unavailable" className={styles.mark} />
          <span className={styles.text}>
            <span className={styles.sentence} data-sentence="">
              {error?.failed ?? CALLOUT_WORDS.failed}
            </span>
            <span className={styles.meta} data-meta="">
              <span>{error?.cause}</span>
              {onRetry && <TextLink onClick={onRetry}>{CALLOUT_WORDS.tryAgain}</TextLink>}
            </span>
          </span>
        </span>
      </CardFrame>
    )
  }

  const { text, replaced } = checkedText(props)
  const tone = replaced ? 'neutral' : props.tone
  const meta = replaced ? CALLOUT_WORDS.mismatchMeta : props.meta
  const interactive = !replaced && ask !== undefined && onAsk !== undefined

  return (
    <CardFrame as="div" onClick={interactive ? () => onAsk(ask) : undefined}>
      <span className={styles.rule} data-rule="" data-tone={replaced ? 'quiet' : tone} aria-hidden="true" />
      <span className={styles.row} role="note">
        <Mark kind={MARK_FOR_TONE[tone]} className={styles.mark} />
        <span className={styles.text}>
          <span className={styles.sentence} data-sentence="" data-quiet={replaced || undefined}>
            <span className="sr-only">{CALLOUT_WORDS.tone[tone]} </span>
            {replaced ? text : withIdentifiers(text)}
          </span>
          {meta && (
            <span className={styles.meta} data-meta="">
              {meta}
            </span>
          )}
        </span>
      </span>
    </CardFrame>
  )
}
