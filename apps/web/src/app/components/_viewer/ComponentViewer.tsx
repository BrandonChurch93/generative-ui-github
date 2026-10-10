'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { animate } from 'motion/react'
import { catalogEntry, type CatalogEntry } from '@genui-github/ui/catalog'
import { MOVES, prefersReducedMotion, REDUCED } from '@genui-github/ui/motion'
import { COMPONENT_STATES, DENSITIES, Segmented, TextLink, type ComponentState, type Density } from '@genui-github/ui'
import { createLogger } from '@genui-github/core'
import styles from '../catalog.module.css'

const log = createLogger('catalog')

const DENSITY_LABELS: Record<Density, string> = { compact: 'Compact', comfortable: 'Comfortable', spacious: 'Spacious' }
const STATE_LABELS: Record<ComponentState, string> = {
  default: 'Default',
  skeleton: 'Skeleton',
  empty: 'Empty',
  error: 'Error',
  warming: 'Warming',
}

// The renderer's card curves: the house arrival curve, and power2.in for the sink.
const ARRIVE = [0.25, 1, 0.5, 1] as const
const EXIT = [0.55, 0.085, 0.68, 0.53] as const
// The card starts sinking partway through its insides' exit, as it does on a composed screen.
const SINK_AFTER = 0.25
const INNER_AFTER = 0.15

interface View {
  density: Density
  state: ComponentState
  variant: string
  /** Bumped by Replay, so the same view can rebuild. */
  run: number
}

const sameView = (a: View, b: View) => a.density === b.density && a.state === b.state && a.variant === b.variant && a.run === b.run

function propsFor(entry: CatalogEntry, view: View): unknown {
  const { sample } = entry
  const chosen = [sample.props, ...(sample.variants ?? []).map(v => v.props)][Number(view.variant)] ?? sample.props
  return view.state === 'empty' && sample.empty ? sample.empty : chosen
}

interface Entering {
  card: { complete(): void; stop(): void }
  inner?: gsap.core.Timeline
}

export function ComponentViewer({
  name,
  initialDensity,
  initialState,
  still,
}: {
  name: string
  initialDensity?: string
  initialState?: string
  /** Render the settled state with no entrance: for screenshots and the accessibility sweep. */
  still?: boolean
}) {
  const entry = catalogEntry(name)!
  const { Component, sample } = entry
  const omitted = new Map<ComponentState, string>((entry.spec?.statesOmitted ?? []).map(o => [o.state, o.reason]))
  const variants = [{ label: 'Sample', props: sample.props }, ...(sample.variants ?? [])]
  const [initial] = useState<View>(() => ({
    density: DENSITIES.find(d => d === initialDensity) ?? 'comfortable',
    state: COMPONENT_STATES.find(s => s === initialState && !omitted.has(s)) ?? 'default',
    variant: '0',
    run: 0,
  }))
  // The controls answer at once; the stage follows once the old piece has left.
  const [wanted, setWanted] = useState<View>(initial)
  const [shown, setShown] = useState<View>(initial)
  const [showJson, setShowJson] = useState(false)
  const pieceRef = useRef<HTMLDivElement>(null)
  const target = useRef(wanted)
  const exiting = useRef(false)
  const entering = useRef<Entering | null>(null)

  // Every rebuild runs the piece's enter the way a composed screen would: the card rises, then its insides.
  useLayoutEffect(() => {
    const piece = pieceRef.current
    const root = piece?.firstElementChild
    if (still || !piece || !(root instanceof HTMLElement)) return
    const reduced = prefersReducedMotion()
    const card = reduced
      ? animate(piece, { opacity: [0, 1] }, { duration: REDUCED.duration, ease: 'linear' })
      : animate(piece, { opacity: [0, 1], y: [MOVES.rise.distance, 0] }, { duration: MOVES.rise.in, ease: ARRIVE })
    const inner =
      shown.state === 'default' && entry.motion ? entry.motion.enter(root, propsFor(entry, shown), { delay: INNER_AFTER, reduced }) : undefined
    const running: Entering = { card, inner }
    entering.current = running
    // A replayed effect (StrictMode) starts from a settled card. An exit already settled this enter, and settling
    // it twice would snap the next piece to full opacity for a frame.
    return () => {
      if (entering.current !== running) return
      card.complete()
      inner?.progress(1).kill()
    }
    // The entry is fixed for this viewer's life: the page remounts it per component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, still])

  // A switch runs the old piece's exit, the strict reverse of its enter, and only then commits the new view.
  useEffect(() => {
    target.current = wanted
    if (exiting.current || sameView(wanted, shown)) return
    const piece = pieceRef.current
    const root = piece?.firstElementChild
    if (still || !piece || !(root instanceof HTMLElement)) {
      setShown(wanted)
      return
    }
    // An interrupted enter sinks from wherever its card got to; its insides settle so their exit has a start.
    entering.current?.card.stop()
    entering.current?.inner?.progress(1).kill()
    entering.current = null
    exiting.current = true
    const reduced = prefersReducedMotion()
    const inner = shown.state === 'default' && entry.motion ? entry.motion.exit(root, propsFor(entry, shown), { reduced }) : undefined
    const delay = Math.min((inner?.duration() ?? 0) / 2, SINK_AFTER)
    const card = reduced
      ? animate(piece, { opacity: 0 }, { duration: REDUCED.duration, ease: 'linear', delay })
      : animate(piece, { opacity: 0, y: MOVES.rise.distance }, { duration: MOVES.rise.out, ease: EXIT, delay })
    // Once the card has sunk its insides are out of sight, so the swap need not wait for their last frame.
    void card.finished
      .then(
        () => undefined,
        () => undefined,
      )
      .then(() => {
        inner?.progress(1).kill()
        exiting.current = false
        setShown(target.current)
      })
    // Exits are not cancelled by a later switch: the newest choice is read from `target` when this one ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, shown, still])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('density', wanted.density)
    url.searchParams.set('state', wanted.state)
    window.history.replaceState(window.history.state, '', url)
  }, [wanted.density, wanted.state])

  const props = propsFor(entry, shown)
  const json = JSON.stringify(
    {
      component: entry.name,
      state: shown.state,
      props,
      ...(shown.state === 'error' ? { error: sample.error } : {}),
      ...(shown.state === 'warming' ? { warming: sample.warming } : {}),
    },
    null,
    2,
  )

  const set = <K extends keyof View>(key: K) => (value: View[K]) => setWanted(w => ({ ...w, [key]: value }))

  return (
    <div className={styles.viewer}>
      <div className={styles.controls} data-testid="catalog-controls">
        <Segmented
          label="Density"
          value={wanted.density}
          onChange={set('density')}
          options={DENSITIES.map(d => ({ value: d, label: DENSITY_LABELS[d] }))}
        />
        {variants.length > 1 && (
          <Segmented
            label="Variant"
            value={wanted.variant}
            onChange={set('variant')}
            options={variants.map((v, i) => ({ value: String(i), label: v.label }))}
          />
        )}
        <Segmented
          label="State"
          value={wanted.state}
          onChange={set('state')}
          options={COMPONENT_STATES.map(s => ({
            value: s,
            label: STATE_LABELS[s],
            disabled: omitted.has(s),
            reason: omitted.get(s),
          }))}
        />
      </div>
      {omitted.size > 0 && (
        <ul className={styles.omitted}>
          {[...omitted].map(([s, reason]) => (
            <li key={s}>
              {STATE_LABELS[s]} is left out · {reason}
            </li>
          ))}
        </ul>
      )}
      <div className={styles.stage} data-density={shown.density} data-width={entry.width ?? 'half'} data-ground="bg">
        <div ref={pieceRef} className={styles.piece} data-testid="catalog-piece" data-state={shown.state}>
          <Component
            key={`${shown.variant}:${shown.state}:${shown.run}`}
            props={props}
            state={shown.state}
            error={sample.error}
            warming={sample.warming}
            onRetry={() => log.info('try again pressed', { component: entry.name })}
            onAsk={ask => log.info('ask', { component: entry.name, ask })}
          />
        </div>
      </div>
      <div className={styles.jsonBar}>
        <TextLink onClick={() => setWanted(w => ({ ...w, run: w.run + 1 }))}>Replay</TextLink>
        <TextLink onClick={() => setShowJson(v => !v)}>{showJson ? 'Hide JSON' : 'View JSON'}</TextLink>
        <span className={styles.note}>
          {entry.sampleFile} · {json.split('\n').length} lines
        </span>
      </div>
      {showJson && (
        <pre className={styles.json} data-testid="catalog-json">
          <code>{json}</code>
        </pre>
      )}
    </div>
  )
}
