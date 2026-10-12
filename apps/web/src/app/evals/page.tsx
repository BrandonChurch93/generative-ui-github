import { CardFrame, StateRow } from '@genui-github/ui'
import { failingList, productionMetrics, versusSonnet } from '../../evals/bind'
import { Latency } from '../../evals/Latency'
import { ModelCard } from '../../evals/ModelCard'
import { Piece } from '../../evals/Piece'
import { loadResults, MODEL_ORDER } from '../../evals/results'
import { composedDone, MODEL_TITLE, modelFinding, modelIds, repoCount, runWhen, setWords, timesWord } from '../../evals/view'
import { Frame } from '../../shell/Frame'
import { MIDDOT } from '../../shell/words'
import chrome from '../../shell/Chrome.module.css'
import strip from '../../shell/Strip.module.css'
import styles from './evals.module.css'

export const metadata = { title: 'Evals · Generative UI for GitHub Repos' }

// Results files land in packages/evals/results after each run; reading them per request shows a new run without a deploy.
export const dynamic = 'force-dynamic'

export default function EvalsPage() {
  const results = loadResults()
  const runs = MODEL_ORDER.flatMap(m => (results[m] ? [results[m]] : []))
  const production = results.production
  const sonnet = results.sonnet
  const haiku = results.haiku
  const lead = runs[0]
  const finding = production && haiku ? modelFinding(production, haiku) : null

  return (
    <Frame current="evals">
      <div className={styles.page}>
        <header className={chrome.chrome}>
          {lead && (
            <div className={chrome.eyebrow}>
              <span className={chrome.chip}>{lead.aggregate.cases} cases</span>
              <span className={chrome.chip}>{lead.aggregate.runs} runs</span>
              <span className={chrome.chip}>{repoCount(lead)} repos</span>
              <span className={chrome.note}>run {runWhen(lead.date)}</span>
            </div>
          )}
          <h1 className={chrome.question}>How often the composer gets it right</h1>
          {lead ? (
            <p className={styles.lede}>
              <b>{lead.aggregate.cases} cases</b>: {setWords(lead)}. Each case ran {timesWord(lead.aggregate.runs)} per model, through the composer itself.
            </p>
          ) : (
            <p className={styles.lede}>The 99 cases run three times per model; their scores appear here after the first full run.</p>
          )}
        </header>

        {!lead && (
          <CardFrame title="Eval results">
            <div data-evals-empty="">
              <StateRow kind="empty" title="No eval run recorded yet" meta="results appear after the first full run" />
            </div>
          </CardFrame>
        )}

        {production && (
          <section className={styles.metrics} aria-label="Production at a glance">
            {productionMetrics(production).map(props => (
              <div key={props.measure} data-metric="">
                <Piece name="Metric" props={props} />
              </div>
            ))}
          </section>
        )}

        {production && (
          <div className={styles.split}>
            <Latency doneMs={composedDone(production)} p50={production.aggregate.latency.doneP50} p90={production.aggregate.latency.doneP90} runs={production.aggregate.runs} model="production" />
            {sonnet ? (
              <Piece name="Comparison" props={versusSonnet(production, sonnet)} />
            ) : (
              <CardFrame title="Against Sonnet alone">
                <StateRow kind="empty" title="No Sonnet run recorded yet" meta="the comparison needs both runs" />
              </CardFrame>
            )}
          </div>
        )}

        {runs.length > 0 && (
          <section className={styles.models} aria-label="Results by model">
            <div className={styles.grid}>
              {runs.map(file => (
                <ModelCard key={file.model} file={file} />
              ))}
            </div>
            {finding && (
              <p className={styles.finding} data-finding="">
                {finding}
              </p>
            )}
            {sonnet && (
              <p className={styles.note} data-sonnet-note="">
                The Sonnet run composes every question off-template on purpose, so it skips routing, and template and bindings are not scored for it.
              </p>
            )}
          </section>
        )}

        {production && <Piece name="StatusList" props={failingList(production)} />}

        {runs.length > 0 && (
          <footer className={strip.strip} aria-label="Run receipt" data-evals-strip="">
            {runs.map(file => (
              <span key={file.model}>
                <b>{MODEL_TITLE[file.model].toLowerCase()}</b>
                {MIDDOT}run {runWhen(file.date)}
                {MIDDOT}
                {modelIds(file)}
              </span>
            ))}
          </footer>
        )}
      </div>
    </Frame>
  )
}
