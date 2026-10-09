import { Fragment, type ReactNode } from 'react'
import { CardFrame, Skeleton, SkeletonBlock, Spine, StateRow, TextLink } from '../../parts'
import type { PieceRenderProps } from '../../types'
import { splitFact } from './fact'
import { STEPS_WORDS, type Step, type StepLink, type StepsProps } from './schema'
import styles from './Steps.module.css'

// Each segment hangs under its own ring and stops space-1 above the next one, which sits a hairline into its row.
const SEGMENT_TOP = 'calc(var(--hairline) + var(--step-ring) + var(--space-1))'
const SEGMENT_BOTTOM = 'calc(var(--space-1) - var(--step-gap) - var(--hairline))'
const SEGMENT_X = 'calc(var(--inset) + var(--step-ring) / 2 - var(--hairline) / 2)'

/** Backticks mark code, which sets in mono and never breaks. Nothing else in the body is formatted. */
function withCode(body: string): ReactNode[] {
  return body.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
      <code key={i} className={styles.code}>
        {part.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

function Fact({ fact }: { fact: string }) {
  const { before, value, after } = splitFact(fact)
  return (
    <span className={styles.fact} data-fact="">
      {value === undefined ? (
        fact
      ) : (
        <>
          {before}
          <span data-count="">{fact.slice(before.length, fact.length - after.length)}</span>
          {after}
        </>
      )}
    </span>
  )
}

function opensWords(href: string): string {
  try {
    const host = new URL(href).hostname
    return host === 'github.com' || host.endsWith('.github.com') ? STEPS_WORDS.opensGitHub : STEPS_WORDS.opensTab
  } catch {
    return STEPS_WORDS.opensTab
  }
}

function Arrow() {
  return (
    <svg className={styles.arrow} viewBox="0 0 12 12" fill="none" aria-hidden="true" data-arrow="">
      <path d="M4.5 3H9v4.5" />
      <path d="M9 3 3 9" />
    </svg>
  )
}

function Link({ link, onAsk }: { link: StepLink; onAsk?: (ask: string) => void }) {
  if ('href' in link) {
    return (
      <TextLink href={link.href} external className={styles.link}>
        {link.label}{' '}
        <span className="sr-only">{opensWords(link.href)}</span>
        <Arrow />
      </TextLink>
    )
  }
  // An ask stays in the app: it recomposes the screen. Without a handler it is still a real link to the same question.
  return onAsk ? (
    <TextLink onClick={() => onAsk(link.ask)} className={styles.link}>
      {link.label}
    </TextLink>
  ) : (
    <TextLink href={`?q=${encodeURIComponent(link.ask)}`} className={styles.link}>
      {link.label}
    </TextLink>
  )
}

function StepItem({ step, n, total, onAsk }: { step: Step; n: number; total: number; onAsk?: (ask: string) => void }) {
  return (
    <li className={styles.step} data-row={step.id} data-first={n === 1 || undefined}>
      {n < total && <Spine top={SEGMENT_TOP} bottom={SEGMENT_BOTTOM} x={SEGMENT_X} />}
      <span className={styles.ring} aria-hidden="true" data-ring="">
        <span data-numeral="">{n}</span>
      </span>
      <div className={styles.content}>
        <div className={styles.top}>
          <h3 className={styles.title} data-words="">
            <span className="sr-only">{STEPS_WORDS.stepOf(n, total)}</span>
            {step.title}
          </h3>
          {step.fact !== undefined && <Fact fact={step.fact} />}
        </div>
        <p className={styles.body} data-words="">
          {withCode(step.body)}
        </p>
        {step.link && <Link link={step.link} onAsk={onAsk} />}
      </div>
    </li>
  )
}

const SKELETON = [
  { title: '46%', fact: '5.5rem', body: ['94%', '36%'], link: '7.75rem' },
  { title: '38%', fact: '3.5rem', body: ['82%'], link: '6.75rem' },
  { title: '42%', fact: '6rem', body: ['74%'] },
]

function SkeletonSteps() {
  return (
    <ol className={styles.list} aria-hidden="true">
      {SKELETON.map(s => (
        <li key={s.title} className={styles.step}>
          <SkeletonBlock width="var(--step-ring)" height="var(--step-ring)" round className={styles.disc} />
          <div className={styles.content}>
            <div className={styles.skeletonTop}>
              <Skeleton text="action" width={s.title} />
              <Skeleton text="meta" width={s.fact} />
            </div>
            <div className={styles.skeletonBody}>
              {s.body.map(w => (
                <Skeleton key={w} text="body" width={w} />
              ))}
            </div>
            {s.link && <Skeleton text="label" width={s.link} className={styles.skeletonLink} />}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function Steps({ props, state, error, warming, onAsk, onRetry }: PieceRenderProps<StepsProps>) {
  const { title, meta, steps } = props

  return (
    <CardFrame
      title={state === 'skeleton' ? <Skeleton text="card-title" width="7rem" /> : title}
      meta={state === 'skeleton' ? <Skeleton text="meta" width="5.5rem" /> : meta}
      busy={state === 'skeleton' || state === 'warming'}
      progress={state === 'warming' ? warming?.progress : undefined}
      ariaLabel={state === 'skeleton' ? `Loading ${title}` : undefined}
      className={styles.card}
    >
      {state === 'skeleton' && (
        <>
          <SkeletonSteps />
          <span className="sr-only">{STEPS_WORDS.loading}</span>
        </>
      )}
      {state === 'default' && (
        // Some browsers drop list semantics once the markers are removed, so the role is stated.
        <ol className={styles.list} role="list" data-steps="">
          {steps.map((step, i) => (
            <StepItem key={step.id} step={step} n={i + 1} total={steps.length} onAsk={onAsk} />
          ))}
        </ol>
      )}
      {state === 'error' && (
        <StateRow
          kind="error"
          title={error?.failed ?? STEPS_WORDS.failed}
          meta={error?.cause}
          action={onRetry && <TextLink onClick={onRetry}>Try again</TextLink>}
        />
      )}
      {state === 'warming' && <StateRow kind="warming" title={warming?.counting} meta={warming?.nextCheck} />}
    </CardFrame>
  )
}
