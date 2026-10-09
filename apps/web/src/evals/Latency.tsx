import type { CSSProperties } from 'react'
import { CardFrame } from '@genui-github/ui'
import { Distribution } from '@genui-github/ui/schemas'
import { MIDDOT } from '../shell/words'
import styles from './Latency.module.css'

// Distribution's geometry and words on a ladder of seconds. The catalog Distribution bins minutes to days for
// review waits, which would put every composition in its first bin, so the eval page draws its own.

/** Upper bin edges in seconds: seven bins, fastest first. */
export const LATENCY_EDGES = [2, 4, 6, 8, 10, 15] as const
const EDGE_LABELS = LATENCY_EDGES.map(s => `${s}s`)
const BIN_WORDS = ['under 2 s', '2 to 4 s', '4 to 6 s', '6 to 8 s', '8 to 10 s', '10 to 15 s', 'over 15 s']
const BINS = BIN_WORDS.length

const binOf = (ms: number) => LATENCY_EDGES.filter(edge => ms / 1000 >= edge).length
const center = (bin: number) => `${((bin + 0.5) / BINS) * 100}%`
const edgeAt = (j: number) => `${((j + 1) / BINS) * 100}%`
const about = (ms: number) => `${(ms / 1000).toFixed(1)} s`
const answers = (n: number) => `${n.toLocaleString('en-US')} composed ${n === 1 ? 'answer' : 'answers'}`

export function Latency({ doneMs, p50, p90, runs, model }: { doneMs: number[]; p50: number; p90: number; runs: number; model: string }) {
  const counts = Array.from({ length: BINS }, (_, i) => doneMs.filter(ms => binOf(ms) === i).length)
  const scale = Distribution.countScale(Math.max(0, ...counts))
  const grid = scale.ticks.slice(1, -1)
  const medianBin = binOf(p50)
  const p90Bin = binOf(p90)
  const finding = `Half of ${model} answers finished within ${about(p50)}. 1 in 10 took more than ${about(p90)}.`
  const h = (v: number): CSSProperties => ({ '--h': `${(v / scale.max) * 100}%` }) as CSSProperties
  const x = (left: string): CSSProperties => ({ '--x': left }) as CSSProperties

  return (
    <CardFrame as="figure" title="Time to done" meta={model} tableView>
      <div className={styles.body} data-latency="">
        <div role="group" aria-label={finding}>
          <div className={styles.chart} data-chart-body="">
            <div className={styles.ticks} aria-hidden="true">
              <span className={styles.sizer}>{String(grid.at(-1) ?? '')}</span>
              {grid.map(t => (
                <span key={t} className={styles.tick} style={h(t)}>
                  {t}
                </span>
              ))}
            </div>
            <div className={styles.area}>
              <div className={styles.plot} aria-hidden="true">
                {grid.map(t => (
                  <span key={t} className={styles.grid} style={h(t)} />
                ))}
                <span className={styles.p90} data-flip={p90Bin >= BINS - 2 || undefined} style={x(center(p90Bin))}>
                  <span className={styles.p90Label}>90% by {about(p90)}</span>
                </span>
                <div className={styles.bins}>
                  {counts.map((count, i) => (
                    <span key={i} className={styles.bin} data-bin={i}>
                      <span className={styles.bar} style={h(count)} />
                    </span>
                  ))}
                </div>
                <span className={styles.baseline} />
              </div>
              <span className={styles.marker} style={x(center(medianBin))} aria-hidden="true">
                <span className={styles.stem} />
                <span className={styles.cap} />
                <span className={styles.markerLabel} data-flip={medianBin >= BINS - 2 || undefined}>
                  Median <i>·</i> about <b>{about(p50)}</b>
                </span>
              </span>
            </div>
            <span />
            <div className={styles.axis} aria-hidden="true">
              {EDGE_LABELS.map((label, j) => (
                <span key={label} className={styles.edge} style={x(edgeAt(j))}>
                  {label}
                </span>
              ))}
            </div>
          </div>
          <p className={styles.source} data-chart-body="">
            <span className={styles.narrow}>
              90% by {about(p90)}
              {MIDDOT}
            </span>
            from {answers(doneMs.length)}
            {MIDDOT}
            {runs} runs
          </p>
          <table className="sr-only" data-table-view="">
            <caption>Time to done{MIDDOT}{model}</caption>
            <thead>
              <tr>
                <th scope="col">Time to done</th>
                <th scope="col">Answers</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((count, i) => (
                <tr key={i}>
                  <th scope="row">{BIN_WORDS[i]}</th>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </CardFrame>
  )
}
