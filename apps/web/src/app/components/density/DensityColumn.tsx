'use client'

import { useEffect, useRef, useState } from 'react'
import { CardFrame, type Density } from '@genui-github/ui'
import styles from './density.module.css'

const VARIABLES = ['inset', 'card-y', 'row-y', 'region-gap', 'metric-size', 'suffix-size', 'insight-size', 'control-h', 'plot-h'] as const

export function DensityColumn({ density }: { density: Density }) {
  const root = useRef<HTMLDivElement>(null)
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    const el = root.current
    if (!el) return
    const read = () => {
      const style = getComputedStyle(el)
      setValues(Object.fromEntries(VARIABLES.map(v => [v, style.getPropertyValue(`--${v}`).trim()])))
    }
    read()
    const observer = new ResizeObserver(read)
    observer.observe(document.documentElement)
    return () => observer.disconnect()
  }, [])

  return (
    <section className={styles.column} aria-label={density}>
      <h3 className={styles.level}>{density}</h3>
      <div ref={root} data-density={density} data-testid={`density-${density}`} className={styles.root}>
        <CardFrame title="Median review wait" meta="last 30 days">
          <p className={styles.number}>
            19.6<small className={styles.suffix}>h</small>
          </p>
        </CardFrame>
        <dl className={styles.values}>
          {VARIABLES.map(v => (
            <div key={v} className={styles.pair}>
              <dt>--{v}</dt>
              <dd>{values[v] ?? ''}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
