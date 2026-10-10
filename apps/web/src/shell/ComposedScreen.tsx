'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useReducedMotion } from 'motion/react'
import { Mark, type Density } from '@genui-github/ui'
import dynamic from 'next/dynamic'
import type { AskEvent, StreamTree } from '@genui-github/renderer'
import { Chrome } from './Chrome'
import { rememberRepo } from './lastRepo'
import { Drawer, PieceDrawer, type PieceDrawerContent } from './Drawer'
import { useHintDismissed } from './Hint'
import screen from './ComposedScreen.module.css'
import { Strip } from './Strip'
import { SystemScreen } from './SystemScreens'
import { Tray } from './Tray'
import { useComposition, type Question } from './useComposition'
import { clock, pieceCount } from './words'

export interface ComposedScreenProps {
  owner: string
  name: string
  question: string
  /** The day a sample's data was read, when the repo is a sample. */
  sampleDay?: string
  /** A dev flag that forces one of the special screens. */
  force?: string
}

// The renderer and the schemas it validates with are most of the page's script; the answer arrives after the
// page paints, so they load after it too, and the question, the first thing read, never waits on them.
const Renderer = dynamic(() => import('@genui-github/renderer').then(m => m.Renderer), { ssr: false })

const blankTree = (density: StreamTree['density']): StreamTree => ({ asks: [], regions: { insight: [], metrics: [], main: [], side: [], action: [] }, done: true, id: 'replay', density })

const DENSITY_KEY = 'genui:density'
const DENSITIES: readonly Density[] = ['compact', 'comfortable', 'spacious']

function storedDensity(): Density | undefined {
  try {
    const v = sessionStorage.getItem(DENSITY_KEY)
    return DENSITIES.includes(v as Density) ? (v as Density) : undefined
  } catch {
    return undefined
  }
}

const DENSITY_EVENT = 'genui:density'
/** Where the choice lives when storage refuses it, as in some private windows. */
let fallback: Density | undefined
const currentDensity = () => storedDensity() ?? fallback
const onDensityChange = (notify: () => void) => {
  window.addEventListener(DENSITY_EVENT, notify)
  return () => window.removeEventListener(DENSITY_EVENT, notify)
}

/** The reader's density, kept for the session (docs/decisions.md, Product). */
function useDensityOverride(): [Density | undefined, (d: Density) => void] {
  const value = useSyncExternalStore(onDensityChange, currentDensity, () => undefined)
  const set = useCallback((d: Density) => {
    try {
      sessionStorage.setItem(DENSITY_KEY, d)
    } catch {
      fallback = d
    }
    window.dispatchEvent(new Event(DENSITY_EVENT))
  }, [])
  return [value, set]
}

const pathFor = (owner: string, name: string, question: string) => `/r/${owner}/${name}?q=${encodeURIComponent(question)}`

/** Where the strip wipes in: after the last card of a full entrance has risen. */
const STRIP_AT = 1.5

/**
 * The composed screen (`screens/Main.html`): the chrome, the answer the stream builds, the strip and the tray.
 * Clicking a piece asks its question; `r` replays the whole screen out and in.
 */
export function ComposedScreen({ owner, name, question: initial, sampleDay, force }: ComposedScreenProps) {
  const repo = `${owner}/${name}`
  const media = useReducedMotion()
  const reduced = media ?? false
  const [ask, setAsk] = useState<Question>({ question: initial, n: 0 })
  const [askedAt, setAskedAt] = useState(() => Date.now())
  const [override, chooseDensity] = useDensityOverride()
  const [drawer, setDrawer] = useState(false)
  const [pieceDrawer, setPieceDrawer] = useState<PieceDrawerContent | null>(null)
  const [replay, setReplay] = useState<'in' | 'out'>('in')
  const [hintDismissed, dismissHint] = useHintDismissed()
  const state = useComposition(repo, ask, force)
  const { tree, refusal, served } = state

  const askQuestion = useCallback(
    (question: string, from?: Question['from']) => {
      setAsk(prev => ({ question, ...(from ? { from } : {}), n: prev.n + 1 }))
      setAskedAt(Date.now())
      setDrawer(false)
      window.history.pushState({ question }, '', pathFor(owner, name, question))
    },
    [owner, name],
  )

  useEffect(() => {
    const onPop = () => {
      const q = new URLSearchParams(window.location.search).get('q')
      if (q) {
        setAsk(prev => ({ question: q, n: prev.n + 1 }))
        setAskedAt(Date.now())
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // The one thing kept about a visitor: the last repo that answered, for the landing's offer.
  useEffect(() => {
    if (state.phase === 'done' && !refusal) rememberRepo(repo)
  }, [state.phase, refusal, repo])

  // `r` replays the screen: everything leaves, then the whole entrance runs again.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'r' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (state.phase !== 'done' || drawer || pieceDrawer) return
      setReplay('out')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.phase, drawer, pieceDrawer])

  const blank = useMemo<StreamTree>(() => blankTree(tree.density), [tree.density])

  // The hand-off from WarmingUp: the card leaves before the answer arrives, so the regions growing above it
  // never push it down while it exits (design-system/motion.md, WarmingUp exit).
  const warmTree = tree.regions.main.some(p => p.component === 'WarmingUp')
  const [warmId, setWarmId] = useState<string | undefined>(undefined)
  const [handoff, setHandoff] = useState(false)
  if (warmTree && tree.id && tree.id !== warmId) setWarmId(tree.id)
  if (!warmTree && warmId && tree.id && tree.id !== warmId) {
    setWarmId(undefined)
    setHandoff(true)
  }
  useEffect(() => {
    if (!handoff) return
    const started = Date.now()
    let timer = 0
    const check = () => {
      if (document.querySelector('[data-composition="replay"][data-phase="settled"]') || Date.now() - started > 3000) setHandoff(false)
      else timer = window.setTimeout(check, 50)
    }
    timer = window.setTimeout(check, 50)
    return () => window.clearTimeout(timer)
  }, [handoff])
  // The entrance runs again once the chrome is out and the renderer has settled the empty screen, so the last card has sunk.
  const onChromeExited = useCallback(() => {
    const started = Date.now()
    const check = () => {
      const empty = document.querySelector('[data-composition="replay"][data-phase="settled"]')
      if (empty || Date.now() - started > 3000) setReplay('in')
      else window.setTimeout(check, 50)
    }
    check()
  }, [])

  const density = override ?? tree.density ?? 'comfortable'
  const warming = state.warming !== undefined || tree.regions.main.some(p => p.component === 'WarmingUp')
  const built = !warming && tree.built ? tree.built : undefined
  const capped = served.capped ?? (refusal?.error === 'daily-cap' || refusal?.error === 'visitor-limit' ? refusal.resetAt : undefined)
  const timeZone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined
  const closedUntil = refusal?.error === 'rate-limit' && refusal.resetAt ? clock(refusal.resetAt, timeZone) : capped ? clock(capped, timeZone) : undefined
  const shown = replay === 'in'
  // From the click until the new answer starts to arrive, the tree is the last answer: it leaves, and its receipt is not this question's.
  const stale = Boolean(tree.id) && state.answered !== ask
  const hasAnswer = Boolean(tree.id) && !refusal && !stale && !handoff
  // Up from the first answer until the first click into one; never over a refusal or a warming screen.
  const hint = !hintDismissed && Boolean(tree.id) && !refusal && !warming && !handoff

  const notice = served.capped && hasAnswer ? (
    <>
      <Mark kind="unavailable" />
      <span>
        <b>Cached-only mode.</b> Today&apos;s model budget is spent, so answers composed today still open from cache and new questions wait until {clock(served.capped, timeZone)}.
      </span>
    </>
  ) : undefined

  const onAsk = useCallback((event: AskEvent) => askQuestion(event.ask, { id: event.from, ask: event.ask }), [askQuestion])
  const onFilter = useCallback(
    (event: { from: string; selected: string[] }) => askQuestion(ask.question, { id: event.from, ask: `Narrow to ${event.selected.join(', ') || 'everything'}` }),
    [askQuestion, ask.question],
  )

  return (
    <>
      <div className={screen.screen} data-density={density} data-phase={state.phase} inert={drawer || pieceDrawer ? true : undefined}>
        <Chrome
          repo={repo}
          question={ask.question}
          askedAt={askedAt}
          sampleDay={sampleDay}
          built={hasAnswer ? built : undefined}
          pieces={pieceCount(tree.regions)}
          cachedAt={served.served === 'cache' ? served.cachedAt : undefined}
          asks={hasAnswer && !warming ? tree.asks : undefined}
          notice={notice}
          hint={hint}
          shown={shown}
          reduced={reduced}
          onAsk={q => {
            dismissHint()
            askQuestion(q)
          }}
          onOpenDrawer={() => setDrawer(true)}
          onExited={onChromeExited}
        />
        {refusal ? (
          <SystemScreen repo={repo} question={ask.question} refusal={refusal} timeZone={timeZone} onRetry={() => setAsk(prev => ({ ...prev, n: prev.n + 1 }))} />
        ) : (
          // Any click inside the answer counts as the reader finding out it is clickable: asks, links out, drawers, chips.
          <div className={screen.answer} aria-busy={state.phase === 'composing' || undefined} onClickCapture={dismissHint}>
            <Renderer
              tree={shown && !handoff ? tree : blank}
              awaiting={stale}
              anchor={ask.from?.id}
              density={density}
              reduced={reduced}
              onAsk={onAsk}
              onRetry={() => setAsk(prev => ({ ...prev, n: prev.n + 1 }))}
              onOpenDrawer={e => setPieceDrawer(e.content)}
              onFilter={onFilter}
            />
          </div>
        )}
        {built && hasAnswer && tree.done && (
          <Strip shown={shown} built={built} sample={served.served === 'golden' || Boolean(sampleDay)} cachedAt={served.served === 'cache' ? served.cachedAt : undefined} reduced={reduced} delay={STRIP_AT} onOpenDrawer={() => setDrawer(true)} />
        )}
      </div>
      <Tray repo={repo} density={density} onDensity={chooseDensity} onAsk={q => askQuestion(q)} closedUntil={closedUntil} />
      <Drawer open={drawer} onClose={() => setDrawer(false)} built={built} tree={tree} question={ask.question} repo={repo} served={served} sample={Boolean(sampleDay)} />
      <PieceDrawer content={pieceDrawer} onClose={() => setPieceDrawer(null)} />
    </>
  )
}

export { DENSITY_KEY }
