'use client'

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CardFrame, Mark, StateRow, Tag, TextLink, type MarkKind } from '../../parts'
import type { PieceRenderProps } from '../../types'
import { leadCopy, rowMeta, spokenCopy, stoppedCounts, whenWords } from './copy'
import { axisFor, LAST_CHECK, laneFor } from './lanes'
import { rescale, runClock } from './motion'
import { COPY, STATS, STATUS_WORDS, type StatState, type WarmingUpProps } from './schema'
import styles from './WarmingUp.module.css'

type Stat = WarmingUpProps['stats'][number]

const ROW_MARK: Record<StatState, MarkKind> = { counting: 'warming', ready: 'good', cached: 'neutral', missing: 'unavailable' }

/** Backticks mark the repo, which sets in mono. */
function withRepo(sentence: string): ReactNode[] {
  return sentence.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
      <code key={i} className={styles.repo}>
        {part.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

function Row({ stat, status }: { stat: Stat; status: WarmingUpProps }) {
  const lane = laneFor(stat, status)
  const words = STATUS_WORDS[stat.state]
  return (
    <li className={styles.row} data-row={stat.id} data-settled={lane.settled || undefined}>
      <span className={styles.text}>
        <span className={styles.name}>{STATS[stat.id].name}</span>
        <span className={styles.meta}>{rowMeta(stat)}</span>
      </span>
      <span
        className={styles.lane}
        data-lane=""
        data-counting={!lane.settled || undefined}
        style={lane.end !== null ? ({ '--end': lane.end } as CSSProperties) : undefined}
        aria-hidden="true"
      >
        <span className={styles.track} data-track="" />
        {lane.segments.map(([a, b]) => (
          <span
            key={a}
            className={styles.seg}
            data-seg=""
            style={{ '--a': a, '--b': b ?? undefined } as CSSProperties}
          />
        ))}
        <Mark kind={lane.settled ? ROW_MARK[stat.state] : 'warming'} className={styles.head} />
      </span>
      <span className={styles.status} data-status="">
        {words.tag ? <Tag tone={words.tag}>{words.words}</Tag> : <span className={styles.now}>{words.words}</span>}
      </span>
    </li>
  )
}

/** Whole seconds since the status arrived, counted by the component between the data layer's checks. */
function useSecondsSince(key: string, running: boolean): number {
  const [tick, setTick] = useState({ key, n: 0 })
  if (tick.key !== key) setTick({ key, n: 0 })
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setTick(t => (t.key === key ? { key, n: t.n + 1 } : { key, n: 1 })), 1000)
    return () => clearInterval(id)
  }, [key, running])
  return tick.key === key ? tick.n : 0
}

/** Holds the polite line until something worth saying happens: arrival, a landing, the stop. */
function useSpoken(props: WarmingUpProps): string {
  const key = `${props.repo}|${props.phase}|${props.stats.map(s => `${s.id}:${s.state}`).join(',')}`
  const [spoken, setSpoken] = useState(() => ({ key, text: spokenCopy(props) }))
  if (spoken.key !== key) setSpoken({ key, text: spokenCopy(props) })
  return spoken.key === key ? spoken.text : spokenCopy(props)
}

function Live({ props, onRetry }: { props: WarmingUpProps; onRetry?: () => void }) {
  const { phase, attempt, elapsedMs, nextCheckMs, stats } = props
  const warming = phase === 'warming'
  const rootRef = useRef<HTMLElement>(null)
  const since = useSecondsSince(`${phase}:${attempt}:${elapsedMs}`, warming)
  const spoken = useSpoken(props)

  const startSeconds = Math.min(LAST_CHECK, elapsedMs / 1000)
  const axis = axisFor(warming ? Math.min(LAST_CHECK, startSeconds + since) : LAST_CHECK)
  const secondsLeft = Math.ceil((nextCheckMs - since * 1000) / 1000)
  const counting = stats.filter(s => s.state === 'counting').length
  const ready = stats.filter(s => s.state === 'ready').length
  const lead = leadCopy(props)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || !warming) return
    const clock = runClock(root, startSeconds)
    return () => {
      clock.kill()
    }
  }, [warming, startSeconds, attempt])

  const shownMax = useRef<number>(axis.max)
  useLayoutEffect(() => {
    const root = rootRef.current
    if (root && shownMax.current !== axis.max) rescale(root, shownMax.current, axis.max)
    shownMax.current = axis.max
  }, [axis.max])

  return (
    <section
      ref={rootRef}
      className={styles.root}
      data-piece="WarmingUp"
      data-state="default"
      data-phase={phase}
      aria-label={COPY.region}
      aria-busy={(warming && counting > 0) || undefined}
      style={{ '--clock': startSeconds, '--max': axis.max } as CSSProperties}
    >
      <p className="sr-only" role="status">
        {spoken}
      </p>
      <div className={styles.lead} data-lead="">
        <Mark kind={warming ? 'warming' : 'unavailable'} className={styles.leadMark} />
        <p className={styles.say} data-say="">
          {withRepo(lead.say)}
        </p>
        {lead.why && (
          <p className={styles.why} data-why="">
            {lead.why}
          </p>
        )}
        <p className={styles.when} data-when="" aria-hidden={warming || undefined}>
          <span>{whenWords(props, secondsLeft)}</span>
          {!warming && onRetry && <TextLink onClick={onRetry}>Try again</TextLink>}
        </p>
      </div>
      <CardFrame
        className={styles.card}
        title={COPY.title}
        meta={
          warming ? (
            <>
              <span data-ready-count="">{ready}</span>
              {COPY.readyOf(stats.length)}
            </>
          ) : (
            stoppedCounts(props)
          )
        }
        progress={warming && stats.length ? ready / stats.length : 0}
      >
        <div className={styles.plot}>
          <div className={styles.grid} aria-hidden="true">
            {axis.ticks.map(s => (
              <i key={s} className={styles.gridline} data-gridline="" style={{ '--s': s } as CSSProperties} />
            ))}
          </div>
          <ul className={styles.list}>
            {stats.map(stat => (
              <Row key={stat.id} stat={stat} status={props} />
            ))}
          </ul>
        </div>
        <div className={styles.axis} aria-hidden="true">
          <span className={styles.axisNote}>{COPY.axisNote}</span>
          <div className={styles.ticks}>
            {axis.ticks.map(s => (
              <span key={s} className={styles.tick} data-tick="" style={{ '--s': s } as CSSProperties}>
                {s}s
              </span>
            ))}
          </div>
        </div>
      </CardFrame>
    </section>
  )
}

export function WarmingUp({ props, state, error, onRetry }: PieceRenderProps<WarmingUpProps>) {
  if (state === 'error') {
    return (
      <section className={styles.root} data-piece="WarmingUp" data-state="error" aria-label={COPY.region}>
        <CardFrame className={styles.card} title={COPY.title}>
          <StateRow
            kind="error"
            title={error?.failed ?? COPY.failed}
            meta={error?.cause}
            action={onRetry && <TextLink onClick={onRetry}>Try again</TextLink>}
          />
        </CardFrame>
      </section>
    )
  }
  // Skeleton, empty and warming are omitted (see the spec): whatever the renderer asks for, the status decides.
  return <Live props={props} onRetry={onRetry} />
}
