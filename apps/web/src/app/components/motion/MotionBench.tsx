'use client'

import { useEffect, useRef, useState } from 'react'
import { bloom, count, draw, extend, MOVES, rise, slide, wipe, type Direction } from '@genui-github/ui/motion'
import { CardFrame, Segmented } from '@genui-github/ui'
import styles from './motion.module.css'

type Mode = 'auto' | 'reduced'
type Runner = (direction: Direction, reduced: boolean | undefined) => gsap.core.Timeline | undefined

function useRunner(make: (direction: Direction, reduced: boolean | undefined) => gsap.core.Timeline | undefined) {
  const current = useRef<gsap.core.Timeline | undefined>(undefined)
  useEffect(() => () => void current.current?.kill(), [])
  return (direction: Direction, reduced: boolean | undefined) => {
    current.current?.kill()
    current.current = make(direction, reduced)
    return current.current
  }
}

function Demo({ name, timing, register, children }: { name: string; timing: string; register: Runner; children: React.ReactNode }) {
  return (
    <CardFrame title={name} meta={timing} headingLevel={3}>
      <div className={styles.demo} data-move={name}>
        {children}
      </div>
      <div className={styles.buttons}>
        <button type="button" className={styles.button} onClick={() => register('in', undefined)}>
          In
        </button>
        <button type="button" className={styles.button} onClick={() => register('out', undefined)}>
          Out
        </button>
      </div>
    </CardFrame>
  )
}

const ms = (s: number) => `${Math.round(s * 1000)}ms`

export function MotionBench() {
  const [mode, setMode] = useState<Mode>('auto')
  const [runs, setRuns] = useState(0)
  const reduced = mode === 'reduced' ? true : undefined

  const wipeRef = useRef<HTMLParagraphElement>(null)
  const barRef = useRef<HTMLSpanElement>(null)
  const rowsRef = useRef<HTMLUListElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const numberRef = useRef<HTMLSpanElement>(null)
  const bloomRef = useRef<HTMLSpanElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const counted = useRef(14.2)

  const runners: Record<string, Runner> = {
    wipe: useRunner((d, r) => wipeRef.current ? wipe(wipeRef.current, { direction: d, reduced: r }) : undefined),
    extend: useRunner((d, r) => barRef.current ? extend(barRef.current, { direction: d, reduced: r, to: 0.72 }) : undefined),
    slide: useRunner((d, r) => rowsRef.current ? slide([...rowsRef.current.children], { direction: d, reduced: r }) : undefined),
    draw: useRunner((d, r) => pathRef.current ? draw(pathRef.current, { direction: d, reduced: r }) : undefined),
    count: useRunner((d, r) => {
      if (!numberRef.current) return undefined
      const from = counted.current
      const to = d === 'in' ? 19.6 : 14.2
      counted.current = to
      return count(numberRef.current, { from, to, reduced: r })
    }),
    bloom: useRunner((_, r) => bloomRef.current ? bloom(bloomRef.current, { reduced: r }) : undefined),
    rise: useRunner((d, r) => cardRef.current ? rise(cardRef.current, { direction: d, reduced: r }) : undefined),
  }

  const run = (name: string): Runner => (d, r) => {
    setRuns(n => n + 1)
    return runners[name]!(d, r ?? reduced)
  }

  const playAll = () => Object.keys(runners).forEach(name => run(name)('in', reduced))

  return (
    <div className={styles.bench}>
      <div className={styles.controls}>
        <Segmented
          label="Motion"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'auto', label: 'Full motion' },
            { value: 'reduced', label: 'Reduced' },
          ]}
        />
        <button type="button" className={styles.button} onClick={playAll}>
          Play all
        </button>
        <span className={styles.note} data-testid="motion-runs">
          {runs} runs
        </span>
      </div>
      <div className={styles.grid} data-density="comfortable">
        <Demo name="wipe" timing={`${ms(MOVES.wipe.in)} in · ${ms(MOVES.wipe.out)} out`} register={run('wipe')}>
          <p ref={wipeRef} className={styles.sentence}>
            Two checks are failing on the release branch.
          </p>
        </Demo>
        <Demo name="extend" timing={`${ms(MOVES.extend.in)} in · ${ms(MOVES.extend.out)} out`} register={run('extend')}>
          <span className={styles.track}>
            <span ref={barRef} className={styles.bar} />
          </span>
        </Demo>
        <Demo name="slide" timing={`${ms(MOVES.slide.in)} in · ${ms(MOVES.slide.stagger)} apart`} register={run('slide')}>
          <ul ref={rowsRef} className={styles.rows}>
            <li>Fix hydration warning in app router</li>
            <li>Bump turbopack to the next canary</li>
            <li>Document the new cache options</li>
          </ul>
        </Demo>
        <Demo name="draw" timing={`${ms(MOVES.draw.in)} in · ${ms(MOVES.draw.out)} out`} register={run('draw')}>
          <svg className={styles.plot} viewBox="0 0 240 64" aria-hidden="true">
            <path ref={pathRef} d="M2 52 L40 48 L78 50 L116 38 L154 40 L192 24 L238 12" />
          </svg>
        </Demo>
        <Demo name="count" timing={ms(MOVES.count.duration)} register={run('count')}>
          <span ref={numberRef} className={styles.number}>
            14.2
          </span>
        </Demo>
        <Demo name="bloom" timing={`${ms(MOVES.bloom.up)} up · ${ms(MOVES.bloom.down)} down`} register={run('bloom')}>
          <span className={styles.bloomHost}>
            <span ref={bloomRef} className={styles.bloomLayer} />
            Flagged by the model
          </span>
        </Demo>
        <Demo name="rise" timing={`${ms(MOVES.rise.in)} in · ${ms(MOVES.rise.out)} out`} register={run('rise')}>
          <div ref={cardRef} className={styles.miniCard}>
            A card rises 10px and never scales.
          </div>
        </Demo>
      </div>
    </div>
  )
}
