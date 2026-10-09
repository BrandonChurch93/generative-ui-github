'use client'

import { useEffect, useState } from 'react'
import { catalogEntry } from '@genui-github/ui/catalog'
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

export function ComponentViewer({
  name,
  initialDensity,
  initialState,
}: {
  name: string
  initialDensity?: string
  initialState?: string
}) {
  const entry = catalogEntry(name)!
  const omitted = new Map<ComponentState, string>((entry.spec.statesOmitted ?? []).map(o => [o.state, o.reason]))
  const [density, setDensity] = useState<Density>(DENSITIES.find(d => d === initialDensity) ?? 'comfortable')
  const [state, setState] = useState<ComponentState>(
    COMPONENT_STATES.find(s => s === initialState && !omitted.has(s)) ?? 'default',
  )
  const [showJson, setShowJson] = useState(false)

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('density', density)
    url.searchParams.set('state', state)
    window.history.replaceState(null, '', url)
  }, [density, state])

  const { Component, sample } = entry
  const props = state === 'empty' && sample.empty ? sample.empty : sample.props
  const json = JSON.stringify(
    {
      component: entry.name,
      state,
      props,
      ...(state === 'error' ? { error: sample.error } : {}),
      ...(state === 'warming' ? { warming: sample.warming } : {}),
    },
    null,
    2,
  )

  return (
    <div className={styles.viewer}>
      <div className={styles.controls}>
        <Segmented
          label="Density"
          value={density}
          onChange={setDensity}
          options={DENSITIES.map(d => ({ value: d, label: DENSITY_LABELS[d] }))}
        />
        <Segmented
          label="State"
          value={state}
          onChange={setState}
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
      <div className={styles.stage} data-density={density} data-width={entry.spec.heightClass ?? 'fixed'} data-ground="bg">
        <div className={styles.piece} data-testid="catalog-piece" data-state={state}>
          <Component
            props={props}
            state={state}
            error={sample.error}
            warming={sample.warming}
            onRetry={() => log.info('try again pressed', { component: entry.name })}
            onAsk={ask => log.info('ask', { component: entry.name, ask })}
          />
        </div>
      </div>
      <div className={styles.jsonBar}>
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
