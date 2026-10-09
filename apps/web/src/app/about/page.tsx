import Link from 'next/link'
import type { ReactNode } from 'react'
import { CardFrame, registry, Tag, TextLink } from '@genui-github/ui'
import { Piece } from '../../evals/Piece'
import { loadResults } from '../../evals/results'
import { MODEL_TITLE, runWhen, secondsWords, timesWord } from '../../evals/view'
import { ExternalArrow, Frame, GITHUB_URL, OutLink, PORTFOLIO_URL } from '../../shell/Frame'
import { MIDDOT } from '../../shell/words'
import chrome from '../../shell/Chrome.module.css'
import { findingSentences, headlineMetrics, runWords, tableRows, type Runs } from './finding'
import styles from './about.module.css'

export const metadata = { title: 'About · Generative UI for GitHub Repos' }

// The finding is read from packages/evals/results per request, as /evals reads it, so a new run shows without an edit.
export const dynamic = 'force-dynamic'

const REPO_PATH = GITHUB_URL.replace(/^https:\/\//, '')

function Arrow() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 1l4 4-4 4" />
    </svg>
  )
}

function InternalArrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 6h7" />
      <path d="M6.5 3l3 3-3 3" />
    </svg>
  )
}

function Section({ id, title, children, body = true }: { id: string; title: string; children: ReactNode; body?: boolean }) {
  return (
    <section className={styles.sec} aria-labelledby={id}>
      <h2 className={styles.h} id={id}>
        {title}
      </h2>
      {body ? <div className={styles.body}>{children}</div> : children}
    </section>
  )
}

function Picks({ items }: { items: [string, string][] }) {
  return (
    <ul className={styles.picks}>
      {items.map(([name, what]) => (
        <li key={name}>
          <b>{name}</b>
          <i>{what}</i>
        </li>
      ))}
    </ul>
  )
}

function Node({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <CardFrame as="div" className={`${styles.node} ${className ?? ''}`}>
      <h3>{title}</h3>
      {children}
    </CardFrame>
  )
}

function Flow() {
  return (
    <div className={styles.flow}>
      <Node title="GitHub API" className={styles.n1}>
        <p className={styles.d}>Public REST and GraphQL reads for the repo you paste.</p>
        <Picks
          items={[
            ['Cache', '15 minutes per repo'],
            ['Warming', 'a wait while GitHub counts'],
          ]}
        />
      </Node>

      <p className={`${styles.band} ${styles.model}`}>
        <span>Model decides</span>
        <i aria-hidden="true" />
      </p>
      <span className={`${styles.wire} ${styles.w1}`} aria-hidden="true">
        <Arrow />
      </span>

      <Node title="Composer" className={styles.n2}>
        <p className={styles.d}>Reads the question and the repo&apos;s numbers, then picks and arranges components.</p>
        <div className={styles.route}>
          <p className={styles.routeRoot}>
            <b>Router</b>
            <i>Haiku · 15 templates, or none</i>
          </p>
          <ul className={styles.tree}>
            <li>
              <b>Template path</b>
              <Tag tone="quiet">Haiku</Tag>
              <i>fixed layout · Haiku writes the words</i>
            </li>
            <li>
              <b>Off-template path</b>
              <Tag tone="quiet">Sonnet</Tag>
              <i>free composition from the registry</i>
            </li>
          </ul>
        </div>
      </Node>

      <span className={`${styles.wire} ${styles.w2}`} aria-hidden="true">
        <Arrow />
      </span>

      <Node title="JSON composition" className={styles.n3}>
        <p className={styles.d}>The project&apos;s own format. Meaning only, never a color or a size.</p>
        <pre className={styles.code}>
          <code>
            <i>{'{'}</i>
            {'\n  '}
            <i>&quot;component&quot;:</i> &quot;Metric&quot;,{'\n  '}
            <i>&quot;props&quot;: {'{'}</i>
            {'\n    '}
            <i>&quot;hot&quot;:</i> true,{'\n    '}
            <i>&quot;deltaTone&quot;:</i> &quot;crit&quot;{'\n  '}
            <i>{'}'}</i>
            {'\n'}
            <i>{'}'}</i>
          </code>
        </pre>
        <Picks items={[['A2UI adapter', 'the same tree, for hosts that speak A2UI']]} />
      </Node>

      <p className={`${styles.band} ${styles.codeBand}`}>
        <span>Code renders</span>
        <i aria-hidden="true" />
      </p>
      <span className={`${styles.wire} ${styles.w3}`} aria-hidden="true">
        <Arrow />
      </span>

      <Node title="Renderer" className={styles.n4}>
        <p className={styles.d}>Checks each piece against its schema, then draws it from the catalog.</p>
        <Picks
          items={[
            ['Component catalog', 'one Zod schema each, read by the model'],
            ['Design tokens', 'tone, emphasis and density become values'],
          ]}
        />
      </Node>

      <span className={`${styles.wire} ${styles.w4}`} aria-hidden="true">
        <Arrow />
        <span className={styles.fork} />
        <span className={styles.forkHead}>
          <Arrow />
        </span>
      </span>

      <div className={styles.n5}>
        <Node title="Web app">
          <p className={styles.d}>Paste a repo, ask, read the screen.</p>
          <p className={styles.m}>Next.js on Vercel</p>
        </Node>
        <Node title="MCP App">
          <p className={styles.d}>The same renderer inside a chat host.</p>
          <p className={styles.m}>compact density</p>
        </Node>
      </div>
    </div>
  )
}

function Finding({ runs }: { runs: Runs }) {
  const { production } = runs
  const models = (['production', 'sonnet', 'haiku'] as const).filter(m => runs[m])
  const rows = tableRows(runs)
  const offTemplate = new Set(production.cases.filter(c => c.kind === 'off-template').map(c => c.id)).size
  return (
    <>
      <div className={styles.body}>
        <p className={styles.p}>
          The eval harness runs {production.aggregate.cases} cases {timesWord(production.aggregate.runs)} per model through the composer itself and scores every answer. Production is the shipped routing: Haiku picks a template and
          fills it, and Sonnet composes only what no template fits. The other two runs compose every question with one model.
        </p>
        {findingSentences(runs).map(sentence => (
          <p key={sentence} className={styles.p}>
            {sentence}
          </p>
        ))}
      </div>
      <div className={styles.wide}>
        <h3 className={styles.sub} id="ab-headline">
          Production against Sonnet alone
        </h3>
        <section className={styles.metrics} aria-labelledby="ab-headline">
          {headlineMetrics(runs).map(props => (
            <div key={props.measure} data-metric="">
              <Piece name="Metric" props={props} />
            </div>
          ))}
        </section>
        <CardFrame title="All three runs" meta={runWords(production)} headingLevel={3} className={styles.tableCard}>
          <div className={styles.scroll} role="region" tabIndex={0} aria-label="Pass rates, speed and cost by model" data-about-table="">
            <table className={styles.table}>
              <caption className="sr-only">Pass rates, speed and cost per run model{MIDDOT}mean of {production.aggregate.runs} runs</caption>
              <thead>
                <tr>
                  <th scope="col">Check</th>
                  {models.map(m => (
                    <th key={m} scope="col" className={styles.fig}>
                      {MODEL_TITLE[m]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.name}>
                    <th scope="row">
                      <b>{row.name}</b>
                      <i>{row.what}</i>
                    </th>
                    {models.map(m => (
                      <td key={m} className={styles.fig}>
                        {row.cells[m]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardFrame>
        <p className={styles.note}>
          Production was run {runWhen(production.date)}. Sonnet alone composes every question off-template on purpose, so it is not routed and has no template figure. Haiku alone and production differ only on the {offTemplate} off-template cases. Every case, run by run, is on{' '}
          <TextLink href="/evals" size="hint">
            the evals page
          </TextLink>
          .
        </p>
      </div>
    </>
  )
}

const PRINCIPLES: [string, string][] = [
  ['Meaning, not values', 'The model sends tone, emphasis and density. Color, size and spacing come from the system, so one state always reads one way.'],
  ['Nothing appears without a cause', 'Every piece draws, wipes, extends, slides, counts or blooms into place. Nothing fades in from nowhere.'],
  ['Every enter has a reverse', 'A new answer runs its exits just ahead of its entrances. Pieces that survive morph in place.'],
  ['Warm, light, quiet', 'One coral accent marks what the model chose. Everything else is warm ink on warm white.'],
]

const REFUSALS: [string, string][] = [
  ['No persona toggle', 'The question already says who you are. A maintainer and a first-time contributor ask different things and get different screens.'],
  ['No chatbot', 'Answers are interfaces, not transcripts. The next question is a chip or one line in the tray.'],
  ['No private repos', 'Public data only, read on the server with a read-only token, so there is nothing to authorize and nothing to leak.'],
  ['No accounts', 'Nothing to sign up for and nothing you paste is stored. The only visitor state is a daily question count keyed on a hash.'],
  ['No writes to GitHub', 'An action card drafts an action and shows it. It never writes to GitHub.'],
]

export default function AboutPage() {
  const results = loadResults()
  const production = results.production
  const components = registry.all().length

  const layers: [string, string, string][] = [
    [
      'Component catalog',
      'packages/ui',
      `${components} components in one registry. Each has a Zod schema the model reads, every state it can reach, three densities, its own motion and a sample JSON.`,
    ],
    ['Renderer', 'packages/renderer', 'Validates each piece against the registry, diffs the new tree against the current one so survivors morph instead of remounting, and streams pieces in as they arrive. An A2UI adapter works both ways.'],
    ['Composer', 'packages/composer', "Takes the question and the repo's normalized data and returns a streaming composition. Haiku picks a template and fills its words; Sonnet composes off-template. It never writes HTML."],
    ['Eval harness', 'packages/evals', 'Scores the composer on template, components, hot metrics, schema, bindings, numbers and rules, plus latency and cost, across models.'],
  ]

  return (
    <Frame current="about">
      <div className={styles.page}>
        <header className={`${chrome.chrome} ${styles.hero}`}>
          <div className={chrome.eyebrow}>
            <span className={chrome.note}>about{MIDDOT}how it was built</span>
          </div>
          <h1 className={chrome.question}>Model decides, code renders.</h1>
          <p className={styles.by}>
            Built by{' '}
            <OutLink className={styles.byLink} href={PORTFOLIO_URL}>
              Brandon Church
            </OutLink>
            . Open source, MIT.
          </p>
        </header>

        <Section id="ab-idea" title="The idea">
          <p className={styles.p}>
            Dashboards are drawn once, for the questions someone expected. This one is drawn for the question you ask. Paste a public GitHub repo, ask what you want to know, and an agent picks components from a fixed
            catalog and composes an interface around that repo&apos;s data. The model decides what to show and what matters most. Code renders it from the same finished pieces every time, so an answer nobody designed still
            looks designed.
          </p>
        </Section>

        <section className={styles.sec} aria-labelledby="ab-how">
          <h2 className={styles.h} id="ab-how">
            How it works
          </h2>
          <div className={styles.body}>
            <p className={styles.p}>
              Every question runs the same five steps, left to right, in the order the screen draws. The twelve common questions and three follow-ups match a template, and Haiku fills in its words. Anything else goes to
              Sonnet, which composes from the whole catalog. Either way the model writes only a composition. Code draws every piece of it.
            </p>
            <p className={styles.p}>
              On the five sample repos the twelve answers are precomputed, so they open with no model call.
              {production && ` A fresh repo's answer finished in ${secondsWords(production.aggregate.latency.doneP50)} at the median in the last eval run.`}
            </p>
          </div>
          <Flow />
        </section>

        <Section id="ab-layers" title="The four layers">
          <dl className={styles.dl}>
            {layers.map(([name, pkg, what]) => (
              <div key={name}>
                <dt>
                  {name}
                  <code>{pkg}</code>
                </dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <section className={styles.sec} aria-labelledby="ab-finding">
          <h2 className={styles.h} id="ab-finding">
            What the decision model saved
          </h2>
          {production ? (
            <Finding runs={{ production, sonnet: results.sonnet, haiku: results.haiku }} />
          ) : (
            <div className={styles.body}>
              <p className={styles.p}>The figures appear here after the first full eval run.</p>
            </div>
          )}
        </section>

        <Section id="ab-ds" title="The design system">
          <p className={styles.p}>
            The model can only choose, so every answer is as good as the pieces it chooses from: the catalog is the product. Every color, size and space comes from one token file, density is set once on the screen and
            never per card, and motion is a short list of moves in which every exit is its entrance in reverse.{' '}
            <TextLink href="/catalog">See every component in every state</TextLink>
          </p>
          <div className={styles.grid}>
            {PRINCIPLES.map(([title, text]) => (
              <div key={title} className={styles.item}>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section id="ab-not" title="What it does not do">
          <dl className={styles.dl}>
            {REFUSALS.map(([title, text]) => (
              <div key={title}>
                <dt>{title}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="ab-links" title="Links">
          <nav className={styles.links} aria-labelledby="ab-links">
            <CardFrame as="div" className={styles.linkCard}>
              <a className={styles.link} href={GITHUB_URL} rel="noreferrer">
                <b>Source on GitHub</b>
                <code>{REPO_PATH}</code>
                <ExternalArrow />
                <span className="sr-only">, opens GitHub</span>
              </a>
              <a className={styles.link} href={`${GITHUB_URL}#use-the-packages`} rel="noreferrer">
                <b>npm packages</b>
                <code>@genui-github/ui · @genui-github/renderer</code>
                <ExternalArrow />
                <span className="sr-only">, opens the install steps on GitHub</span>
              </a>
              <a className={styles.link} href={`${GITHUB_URL}#mcp-app`} rel="noreferrer">
                <b>MCP App</b>
                <span>compose(repo, question) inside a chat host. Setup is in the README.</span>
                <ExternalArrow />
                <span className="sr-only">, opens GitHub</span>
              </a>
              <Link className={styles.link} href="/catalog">
                <b>Component catalog</b>
                <span>Every component, rendered from its sample JSON.</span>
                <InternalArrow />
              </Link>
              <Link className={styles.link} href="/evals">
                <b>Eval results</b>
                <span>{production ? `${runWords(production)}${MIDDOT}scored on seven checks.` : 'Every case, scored on seven checks.'}</span>
                <InternalArrow />
              </Link>
            </CardFrame>
          </nav>
        </Section>
      </div>
    </Frame>
  )
}
