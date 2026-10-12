'use client'

import { DENSITIES, type Density } from '@genui-github/ui'
import { catalogEntry } from '@genui-github/ui/catalog'
import styles from './marks.module.css'

// Each case puts a host's own mark slot on screen: the hot Metric, the ActionCard's result once confirmed, the
// DiffView's message for each kind, the Timeline's nodes and the WarmingUp lead and lane heads.
const CASES: { id: string; name: string; props?: (sample: Record<string, unknown>) => Record<string, unknown> }[] = [
  { id: 'metric-hot', name: 'Metric', props: p => ({ ...p, hot: true }) },
  { id: 'actioncard', name: 'ActionCard' },
  { id: 'diff-limit', name: 'DiffView', props: p => ({ ...p, additions: 1200, deletions: 40 }) },
  { id: 'diff-omitted', name: 'DiffView', props: p => ({ ...p, patch: undefined }) },
  { id: 'diff-binary', name: 'DiffView', props: p => ({ ...p, additions: 0, deletions: 0, status: 'modified', patch: undefined }) },
  { id: 'timeline', name: 'Timeline' },
  { id: 'warmingup', name: 'WarmingUp' },
]

function Case({ id, name, props, density }: (typeof CASES)[number] & { density: Density }) {
  const entry = catalogEntry(name)
  if (!entry) return null
  const { Component, sample } = entry
  const base = sample.props as Record<string, unknown>
  return (
    <section className={styles.case} data-case={id} data-density={density} aria-label={`${id} at ${density}`}>
      <Component props={props ? props(base) : base} state="default" warming={sample.warming} />
    </section>
  )
}

export function DevMarks() {
  return (
    <main className={styles.page}>
      {DENSITIES.map(density => (
        <div key={density} className={styles.column}>
          {CASES.map(c => (
            <Case key={c.id} {...c} density={density} />
          ))}
        </div>
      ))}
    </main>
  )
}
