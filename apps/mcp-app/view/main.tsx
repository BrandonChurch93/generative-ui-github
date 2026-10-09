import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@modelcontextprotocol/ext-apps'
import { Renderer } from '@genui-github/renderer'
import { RepoChip, Skeleton, StateRow, TextLink } from '@genui-github/ui'
import '../../../design-system/tokens.css'
import '@genui-github/ui/styles.css'
import type { FrameResult } from '../src/server'
import styles from './view.module.css'

// The frame's half of the MCP App: it waits for the tool's result from the host, then draws the composition
// with the same renderer the web app uses. While GitHub counts a repo, it asks again on the warming schedule.

type Shown = { kind: 'waiting'; repo?: string; question?: string } | FrameResult

const app = new App({ name: 'Generative UI for GitHub Repos', version: '0.1.0' })

const seconds = (ms: number) => (Math.round(ms / 100) / 10).toFixed(1)

function View() {
  const [shown, setShown] = useState<Shown>({ kind: 'waiting' })
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const take = (result: { structuredContent?: unknown }) => {
      const data = result.structuredContent as FrameResult | undefined
      if (data?.kind) setShown(data)
    }
    app.ontoolinput = ({ arguments: args }) => {
      const a = (args ?? {}) as { repo?: string; question?: string }
      setShown({ kind: 'waiting', ...(a.repo ? { repo: a.repo } : {}), ...(a.question ? { question: a.question } : {}) })
    }
    app.ontoolresult = result => take(result)
    app.onhostcontextchanged = () => setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    void app.connect()
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  // GitHub was still counting: ask again when the schedule says, through the app-only tool.
  useEffect(() => {
    if (shown.kind !== 'composition' || shown.warming?.phase !== 'warming') return
    const { repo, question, warming } = shown
    timer.current = setTimeout(() => {
      void app.callServerTool({ name: 'compose-check', arguments: { repo, question, warming } }).then(result => {
        const data = result.structuredContent as FrameResult | undefined
        if (data?.kind) setShown(data)
      })
    }, Math.max(1000, warming.nextCheckMs))
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [shown])

  const repo = shown.repo
  return (
    <div className={styles.shell}>
      <main className={styles.frame} data-density="compact">
        {repo && (
          <p className={styles.eyebrow}>
            <RepoChip repo={repo} />
          </p>
        )}
        {shown.kind === 'waiting' && (
          <div className={styles.waiting} role="status">
            <span className="sr-only">{repo ? `Composing an answer for ${repo}` : 'Composing an answer'}</span>
            <Skeleton text="insight" width="90%" />
            <Skeleton text="insight" width="60%" />
            <Skeleton text="meta" width="40%" />
          </div>
        )}
        {shown.kind === 'refused' && (
          <div className={styles.waiting}>
            <StateRow kind="error" title={shown.message} action={<TextLink onClick={() => void app.openLink({ url: shown.url })}>Open in Generative UI</TextLink>} />
          </div>
        )}
        {shown.kind === 'composition' && (
          <>
            <Renderer
              composition={shown.composition}
              density="compact"
              reduced={reduced}
              onAsk={({ ask }) => void app.sendMessage({ role: 'user', content: [{ type: 'text', text: `${ask} (${shown.repo})` }] })}
            />
            {!shown.warming && (
              <p className={styles.strip}>
                <span>
                  composed in <b>{seconds(shown.composition.built.latencyMs.total)} s</b>
                </span>
                <TextLink onClick={() => void app.openLink({ url: shown.url })}>Open in Generative UI</TextLink>
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <View />
  </StrictMode>,
)
