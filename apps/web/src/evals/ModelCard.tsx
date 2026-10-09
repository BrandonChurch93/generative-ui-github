import { CardFrame } from '@genui-github/ui'
import type { ResultsFile } from '@genui-github/evals'
import { MIDDOT } from '../shell/words'
import styles from './ModelCard.module.css'
import { MODEL_TITLE, modelsLine, pct, SCORER_ORDER, SCORER_WORDS, secondsWords, spreadWords, templateRate, usd, type Rate } from './view'


/** One run model's aggregate: the seven scorers as mean, run spread and n, then speed and cost. */
export function ModelCard({ file }: { file: ResultsFile }) {
  const a = file.aggregate
  const title = MODEL_TITLE[file.model]
  const rate = (scorer: (typeof SCORER_ORDER)[number]): Rate | null => (scorer === 'template' ? templateRate(file) : a.pass[scorer])
  const composed = a.outcomes.composed

  return (
    <CardFrame title={title} meta={modelsLine(file)} className={styles.card} ariaLabel={`${title} results`}>
      <div className={styles.scroll} role="region" tabIndex={0} aria-label={`${title} pass rates`} data-model-table={file.model}>
        <table className={styles.table}>
          <caption className="sr-only">
            {title} pass rates{MIDDOT}mean of {a.runs} runs
          </caption>
          <colgroup>
            <col />
            <col className={styles.colFigure} />
            <col className={styles.colSpread} />
            <col className={styles.colCount} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Check</th>
              <th scope="col" className={styles.num}>
                Passed
              </th>
              <th scope="col" className={styles.num}>
                Spread
              </th>
              <th scope="col" className={styles.num}>
                Cases
              </th>
            </tr>
          </thead>
          <tbody>
            {SCORER_ORDER.map(scorer => {
              const r = rate(scorer)
              const what = scorer === 'components' && a.componentsF1 !== null ? `mean F1 ${a.componentsF1.toFixed(2)}` : SCORER_WORDS[scorer].what
              return (
                <tr key={scorer} data-scorer={scorer}>
                  <th scope="row">
                    <b>{SCORER_WORDS[scorer].name}</b>
                    <i>{scorer === 'template' && file.model === 'sonnet' ? 'off-template only' : what}</i>
                  </th>
                  {r ? (
                    <>
                      <td className={styles.figure}>{pct(r.mean)}%</td>
                      <td className={styles.num}>{spreadWords(r)}</td>
                      <td className={styles.num}>{r.n}</td>
                    </>
                  ) : (
                    <td colSpan={3} className={styles.none}>
                      not scored in this run
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        <table className={styles.table} data-speed="">
          <caption className={styles.subhead}>
            Speed and cost <span>{MIDDOT.trim()} {composed.toLocaleString('en-US')} composed answers</span>
          </caption>
          <colgroup>
            <col />
            <col className={styles.colFigure} />
            <col className={styles.colSpread} />
            <col className={styles.colCount} />
          </colgroup>
          <thead className="sr-only">
            <tr>
              <th scope="col">Measure</th>
              <th scope="col">Typical</th>
              <th scope="col">Tail or total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                <b>Time to done</b>
                <i>median and p90</i>
              </th>
              <td className={styles.figure}>{secondsWords(a.latency.doneP50)}</td>
              <td className={styles.num} colSpan={2}>p90 {secondsWords(a.latency.doneP90)}</td>
            </tr>
            <tr>
              <th scope="row">
                <b>Time to first piece</b>
                <i>median and p90</i>
              </th>
              {a.latency.firstPieceP50 !== null && a.latency.firstPieceP90 !== null ? (
                <>
                  <td className={styles.figure}>{secondsWords(a.latency.firstPieceP50)}</td>
                  <td className={styles.num} colSpan={2}>p90 {secondsWords(a.latency.firstPieceP90)}</td>
                </>
              ) : (
                <td colSpan={3} className={styles.none}>
                  no piece streamed
                </td>
              )}
            </tr>
            <tr>
              <th scope="row">
                <b>Cost</b>
                <i>per answer and in total</i>
              </th>
              <td className={styles.figure}>{usd(a.cost.perCompositionUsd)}</td>
              <td className={styles.num} colSpan={2}>
                {usd(a.cost.totalUsd)} total
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </CardFrame>
  )
}
