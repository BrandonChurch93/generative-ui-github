'use client'

import { useMemo, useState } from 'react'
import { createLogger } from '@genui-github/core'
import { AskRow, DENSITIES, Segmented, TextLink, type Density } from '@genui-github/ui'
import { applyOp, Renderer, toStream, emptyTree, type AskEvent, type Composition, type StreamTree } from '@genui-github/renderer'
import releaseBlockers from '@genui-github/renderer/fixtures/1-release-blockers.json'
import checkFailures from '@genui-github/renderer/fixtures/2-check-failures.json'
import contributors from '@genui-github/renderer/fixtures/3-contributors.json'
import styles from './render.module.css'

const log = createLogger('dev:render')

const FIXTURES = [
  { key: '1', label: 'Release blockers', question: "What's blocking the next release?", composition: releaseBlockers as Composition },
  { key: '2', label: 'Check failures', question: 'Which checks are failing on canary?', composition: checkFailures as Composition },
  { key: '3', label: 'Contributors', question: "Who's carrying this repo?", composition: contributors as Composition },
] as const
type FixtureKey = (typeof FIXTURES)[number]['key']

/** Live data under the same composition: the first metric goes up by one and a list gains a row at the top. */
function liveUpdate(tree: StreamTree, n: number): StreamTree {
  let next = tree
  const metric = tree.regions.metrics[0]
  if (metric && typeof metric.bound === 'object' && metric.bound) {
    const bound = metric.bound as { value: unknown }
    if (typeof bound.value === 'number') next = applyOp(next, { op: 'update', id: metric.id, props: { ...bound, value: bound.value + 1 } })
  }
  const list = tree.regions.main.find(p => p.component === 'StatusList')
  if (list && typeof list.bound === 'object' && list.bound) {
    const bound = list.bound as { kind: string; items: object[] }
    const id = `live-${n}`
    const row =
      bound.kind === 'check'
        ? { id, title: `test-e2e (shard ${n})`, meta: 'running now', state: 'running', value: { durationMin: 4 } }
        : { id, title: `Live row ${n}: a pull request opened just now`, meta: `#${90000 + n} · just now`, state: 'pending', value: { add: 12, del: 3 } }
    next = applyOp(next, { op: 'update', id: list.id, props: { ...bound, items: [row, ...bound.items] } })
  }
  return next
}

const DENSITY_LABELS: Record<Density, string> = { compact: 'Compact', comfortable: 'Comfortable', spacious: 'Spacious' }

/** The three-screen rewrite study: fixture compositions, and clicks that move between them. */
export function DevRender({ initialFixture, initialDensity, reduced }: { initialFixture?: string; initialDensity?: string; reduced?: boolean }) {
  const [key, setKey] = useState<FixtureKey>(FIXTURES.find(f => f.key === initialFixture)?.key ?? '1')
  const [density, setDensity] = useState<Density | undefined>(DENSITIES.find(d => d === initialDensity))
  const [replays, setReplays] = useState(0)
  const [lastAsk, setLastAsk] = useState<AskEvent>()
  const fixture = FIXTURES.find(f => f.key === key)!
  const initialTree = useMemo(() => toStream(fixture.composition).reduce<StreamTree>((t, op) => applyOp(t, op), emptyTree()), [fixture])
  const [live, setLive] = useState<{ key: string; tree: StreamTree; n: number }>()
  const tree = live?.key === key ? live.tree : initialTree

  const ask = (event: AskEvent) => {
    setLastAsk(event)
    const next = FIXTURES.find(f => f.question === event.ask)
    if (next) setKey(next.key)
    else log.info('ask has no fixture', { ...event })
  }

  return (
    <div className={styles.page} data-ground="bg">
      <div className={styles.controls}>
        <Segmented label="Composition" value={key} onChange={setKey} options={FIXTURES.map(f => ({ value: f.key, label: f.label }))} />
        <Segmented
          label="Density"
          value={density ?? fixture.composition.density}
          onChange={setDensity}
          options={DENSITIES.map(d => ({ value: d, label: DENSITY_LABELS[d] }))}
        />
        <TextLink onClick={() => setReplays(n => n + 1)}>Replay</TextLink>
        <TextLink onClick={() => setLive(l => ({ key, tree: liveUpdate(tree, (l?.n ?? 0) + 1), n: (l?.n ?? 0) + 1 }))}>Live update</TextLink>
        <span className={styles.note} data-testid="last-ask">
          {lastAsk ? `${lastAsk.from} · ${lastAsk.ask}` : 'Click a piece, a source or a question to rewrite'}
        </span>
      </div>
      <Renderer key={replays} tree={tree} question={fixture.question} density={density} reduced={reduced} onAsk={ask} />
      <nav className={styles.asks} aria-label="Ask next">
        <AskRow asks={fixture.composition.asks} onAsk={a => ask({ ask: a, from: 'asks' })} />
      </nav>
    </div>
  )
}
