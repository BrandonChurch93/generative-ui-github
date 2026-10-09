'use client'

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react'
import { Tag } from '@genui-github/ui'
import { MOVES, REDUCED, riseVariants } from '@genui-github/ui/motion'
import type { Built, Piece, RegionName, StreamTree } from '@genui-github/renderer'

// Reading order, as the renderer's format names it; a value import from the renderer would load its schemas here.
const REGION_NAMES: readonly RegionName[] = ['insight', 'metrics', 'main', 'side', 'action']
import styles from './Drawer.module.css'
import type { Served } from './useComposition'
import { ago, clock, MIDDOT, modelName, pieceCount, plural, seconds, templateLine } from './words'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  built?: Built
  tree: StreamTree
  question: string
  repo: string
  served: Served
  /** A sample repo answers from its committed copy, never from GitHub. */
  sample?: boolean
}

export interface PieceDrawerContent {
  title: string
  items: string[]
}

const ARRIVE = riseVariants.shown.transition.ease
const LEAVE = riseVariants.gone.transition.ease
const LINEAR = { duration: REDUCED.duration, ease: 'linear' } as const

function sheetVariants(axis: 'x' | 'y', reduced: boolean): Variants {
  if (reduced) return { hidden: { opacity: 0 }, shown: { opacity: 1, transition: LINEAR }, gone: { opacity: 0, transition: LINEAR } }
  const d = MOVES.rise.distance
  const off = axis === 'x' ? { x: d } : { y: d }
  const on = axis === 'x' ? { x: 0 } : { y: 0 }
  return {
    hidden: { opacity: 0, ...off },
    shown: { opacity: 1, ...on, transition: { duration: MOVES.rise.in, ease: ARRIVE, staggerChildren: MOVES.slide.stagger } },
    gone: { opacity: 0, ...off, transition: { duration: MOVES.rise.out, ease: LEAVE, staggerChildren: MOVES.slide.stagger, staggerDirection: -1 } },
  }
}

const SECTION: Variants = {
  hidden: { opacity: 0, x: -MOVES.slide.distance },
  shown: { opacity: 1, x: 0, transition: { duration: MOVES.slide.in, ease: ARRIVE } },
  gone: { opacity: 0, x: -MOVES.slide.distance, transition: { duration: MOVES.slide.out, ease: LEAVE } },
}

/** The sections' slide, off under reduced motion. */
const SectionMotion = createContext<Variants | undefined>(undefined)

const noSubscribe = () => () => {}
const PHONE = '(max-width: 639px)'
const onPhoneChange = (notify: () => void) => {
  const query = window.matchMedia(PHONE)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The floating sheet both drawers use: a modal dialog over the scrim, portalled to the body so the fixed tray can be
 * made inert with the rest of the page. Escape, the scrim and the close button dismiss it; focus moves in, stays in,
 * and goes back to whatever opened it.
 */
function Sheet({ open, onClose, title, sub, foot, children, kind }: { open: boolean; onClose: () => void; title: string; sub?: ReactNode; foot?: ReactNode; children: ReactNode; kind: string }) {
  const titleId = useId()
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false)
  const phone = useSyncExternalStore(onPhoneChange, () => window.matchMedia(PHONE).matches, () => false)
  const reduced = useReducedMotion() ?? false
  const sheet = useRef<HTMLElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const lastFocus = useRef<HTMLElement | null>(null)
  // The screen passes a fresh closure each render; the open effect must not rerun (and refocus) for that.
  const dismiss = useRef(onClose)
  useLayoutEffect(() => {
    dismiss.current = onClose
  })

  // Safari does not focus a button on click, so the last focused element is the fallback opener.
  useEffect(() => {
    if (open) return
    const track = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) lastFocus.current = event.target
    }
    document.addEventListener('focusin', track)
    return () => document.removeEventListener('focusin', track)
  }, [open])

  // Read before the browser moves focus off the opener, which the screen's `inert` will do.
  useLayoutEffect(() => {
    if (!open) return
    const active = document.activeElement
    opener.current = active instanceof HTMLElement && active !== document.body ? active : lastFocus.current
  }, [open])

  useEffect(() => {
    if (!open) return
    const behind = [...document.querySelectorAll<HTMLElement>('[data-tray]')].filter(el => !el.inert)
    for (const el of behind) el.inert = true
    close.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        dismiss.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      for (const el of behind) el.inert = false
      const back = opener.current
      if (back?.isConnected) back.focus()
    }
  }, [open])

  const trap = (event: ReactKeyboardEvent) => {
    if (event.key !== 'Tab' || !sheet.current) return
    const stops = [...sheet.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.getClientRects().length > 0)
    const first = stops[0]
    const last = stops.at(-1)
    if (!first || !last) return
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === sheet.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!mounted) return null
  const fade = reduced ? LINEAR : { duration: MOVES.rise.in, ease: ARRIVE }
  const fadeOut = reduced ? LINEAR : { duration: MOVES.rise.out, ease: LEAVE }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key={kind} className={styles.layer} data-drawer={kind}>
          <motion.div className={styles.scrim} onClick={onClose} aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: fade }} exit={{ opacity: 0, transition: fadeOut }} />
          <motion.aside
            ref={sheet}
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={trap}
            variants={sheetVariants(phone ? 'y' : 'x', reduced)}
            initial="hidden"
            animate="shown"
            exit="gone"
          >
            <div className={styles.head}>
              <div>
                <h2 className={styles.title} id={titleId}>
                  {title}
                </h2>
                {sub && <p className={styles.sub}>{sub}</p>}
              </div>
              <button ref={close} className={styles.close} type="button" aria-label="Close" onClick={onClose}>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M4 4l8 8" />
                  <path d="M12 4l-8 8" />
                </svg>
              </button>
            </div>
            <SectionMotion.Provider value={reduced ? undefined : SECTION}>{children}</SectionMotion.Provider>
            {foot}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Section({ title, aside, children }: { title?: string; aside?: ReactNode; children: ReactNode }) {
  const id = useId()
  const variants = useContext(SectionMotion)
  return (
    <motion.section className={styles.sec} aria-labelledby={title ? id : undefined} variants={variants}>
      {title && (
        <div className={styles.h}>
          <h3 id={id}>{title}</h3>
          {aside && <span>{aside}</span>}
        </div>
      )}
      {children}
    </motion.section>
  )
}

/** "0.62" under ten seconds, "12.4" over: the strip's figures. */
const secs = (ms: number) => seconds(ms).toFixed(seconds(ms) < 10 ? 2 : 1)

/** Small costs keep their first figure: $0.0007, not $0.00. */
function usd(cost: number): string {
  if (cost === 0) return '$0'
  if (cost < 0.0001) return 'under $0.0001'
  return `$${cost.toFixed(cost < 0.01 ? 4 : cost < 1 ? 3 : 2)}`
}

const count = (n: number) => n.toLocaleString('en-US')

function readsLine(built: Built, served: Served, sample?: boolean): string {
  if (served.served === 'golden' || (sample && built.githubReads === 0)) return `read from the committed sample${MIDDOT}no GitHub calls`
  if (built.githubReads > 0) return plural(built.githubReads, 'GitHub read')
  return `read from cached data${MIDDOT}no GitHub calls`
}

function servedLine(served: Served, timeZone?: string): string {
  if (served.served === 'golden') return 'the committed golden set'
  if (served.served === 'cache') return served.cachedAt ? `the answer cache${MIDDOT}composed ${ago(served.cachedAt)}, ${clock(served.cachedAt, timeZone)}` : 'the answer cache'
  return 'composed live for this question'
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The model's meaning choices for a piece, in the system's words. Props carry some (a Metric's `hot`, an Insight's `tone`). */
function choices(piece: Piece): string[] {
  const props = isRecord(piece.props) ? piece.props : {}
  const out: string[] = []
  const tone = piece.tone ?? (typeof props.tone === 'string' ? props.tone : undefined)
  const emphasis = piece.emphasis ?? (typeof props.emphasis === 'string' ? props.emphasis : undefined)
  if (tone) out.push(`tone ${tone}`)
  if (emphasis) out.push(`emphasis ${emphasis}`)
  if (props.hot === true) out.push('hot')
  return out
}

const shortId = (piece: Piece) => {
  const prefix = `${piece.component.toLowerCase()}:`
  return piece.id.toLowerCase().startsWith(prefix) ? piece.id.slice(prefix.length) : piece.id
}

/** What the model sent, without the data the system bound to it. */
function composition(tree: StreamTree, built?: Built) {
  const regions = Object.fromEntries(
    REGION_NAMES.map(region => [
      region,
      tree.regions[region].map(p => ({
        id: p.id,
        component: p.component,
        props: p.props,
        ...(p.ask ? { ask: p.ask } : {}),
        ...(p.emphasis ? { emphasis: p.emphasis } : {}),
        ...(p.tone ? { tone: p.tone } : {}),
      })),
    ]),
  )
  return { id: tree.id, density: tree.density, regions, asks: tree.asks, built }
}

function insightSources(tree: StreamTree): string[] {
  const insight = tree.regions.insight.find(p => p.component === 'Insight')
  const props = insight && isRecord(insight.props) ? insight.props : undefined
  const sources = props && Array.isArray(props.sources) ? props.sources : []
  return sources.flatMap(s => (isRecord(s) && typeof s.key === 'string' ? [s.key] : []))
}

function JsonFoot({ json }: { json: string }) {
  const [shown, setShown] = useState(false)
  const [copied, setCopied] = useState(false)
  const id = useId()
  const size = useMemo(() => `${(new TextEncoder().encode(json).length / 1024).toFixed(1)} KB`, [json])

  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(t)
  }, [copied])

  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(json).then(() => setCopied(true), () => setCopied(false))
  }, [json])

  return (
    <div className={styles.foot}>
      {shown && (
        <pre id={id} className={styles.json} tabIndex={0} aria-label="Composition JSON">
          {json}
        </pre>
      )}
      <div className={styles.footRow}>
        <button type="button" className={styles.link} aria-expanded={shown} aria-controls={shown ? id : undefined} onClick={() => setShown(v => !v)}>
          {shown ? 'Hide the JSON' : 'View the JSON'}
        </button>
        <span className={styles.footMeta}>
          <span>composition.json{MIDDOT}{size}</span>
          {shown && (
            <button type="button" className={styles.link} onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </span>
      </div>
      <span className="sr-only" role="status">
        {copied ? 'Composition JSON copied' : ''}
      </span>
    </div>
  )
}

/** "How this was built" (`screens/Drawer.html`): route, latency, reads, what the model chose, and the JSON. */
export function Drawer({ open, onClose, built, tree, question, repo, served, sample }: DrawerProps) {
  const timeZone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined
  const json = useMemo(() => JSON.stringify(composition(tree, built), null, 2), [tree, built])
  const pieces = pieceCount(tree.regions)
  const sources = insightSources(tree)
  const model = built ? modelName(built.model) : undefined
  const replayed = served.served === 'golden' || served.served === 'cache'

  const rows = built
    ? (() => {
        const t = built.latencyMs
        const steps: { name: string; ms: number; note: string; model?: boolean }[] = [
          { name: 'Classify', ms: t.classify, note: templateLine(built) },
          { name: 'Fetch', ms: t.data, note: readsLine(built, served, sample) },
          { name: 'Compose', ms: t.compose, note: model === 'the templates' ? 'The templates fill the composition' : `${model} writes the composition as JSON`, model: true },
          ...(t.render !== undefined ? [{ name: 'Render', ms: t.render, note: `${plural(pieces, 'component')} checked and drawn` }] : []),
        ]
        let at = 0
        const placed = steps.map(step => {
          const left = t.total > 0 ? Math.min(at / t.total, 1) : 0
          const width = t.total > 0 ? Math.min(step.ms / t.total, 1 - left) : 0
          at += step.ms
          return { ...step, left, width }
        })
        return [...placed, { name: 'Total', ms: t.total, note: 'question to finished composition', left: 0, width: t.total > 0 ? 1 : 0 }]
      })()
    : []

  const picks: { piece: Piece; region: RegionName }[] = REGION_NAMES.flatMap(region => tree.regions[region].map(piece => ({ piece, region })))

  return (
    <Sheet
      kind="built"
      open={open}
      onClose={onClose}
      title="How this was built"
      sub={
        <>
          What the composer read, chose and sent for &ldquo;{question}&rdquo; on {repo}.
        </>
      }
      foot={<JsonFoot json={json} />}
    >
      <Section title="Route" aside={built ? (built.template === 'off-template' ? 'off-template path' : 'template path') : undefined}>
        <p className={styles.p}>Common questions fill a fixed template with Haiku. Anything else goes to Sonnet, which composes from the whole catalog.</p>
        {built ? (
          <dl className={styles.facts}>
            <dt>route</dt>
            <dd>{built.template === 'off-template' ? `off-template${built.reason ? `${MIDDOT}${built.reason}` : ''}` : `template${MIDDOT}${built.template}`}</dd>
            <dt>model</dt>
            <dd>{model}</dd>
            <dt>tokens</dt>
            <dd>
              {count(built.tokens.input)} in{MIDDOT}
              {count(built.tokens.cached)} cached{MIDDOT}
              {count(built.tokens.output)} out
            </dd>
            <dt>cost</dt>
            <dd>{usd(built.costUsd)}</dd>
            <dt>served</dt>
            <dd>{servedLine(served, timeZone)}</dd>
            {built.chose.length > 0 && (
              <>
                <dt>chose</dt>
                <dd>{built.chose.join(MIDDOT)}</dd>
              </>
            )}
          </dl>
        ) : (
          <p className={styles.meta}>The composition is still arriving.</p>
        )}
      </Section>

      <Section title="Latency" aside={built ? `${secs(built.latencyMs.total)} s in all` : undefined}>
        {replayed && (
          <p className={styles.p}>
            {served.served === 'golden' ? 'This answer opened from the committed golden set' : 'This answer opened from the answer cache'}, so these are the original composition&apos;s timings.
          </p>
        )}
        {built ? (
          <ol className={styles.wf}>
            {rows.map(row => (
              <li key={row.name} data-step={row.name.toLowerCase()}>
                <div className={styles.wfTop}>
                  {row.name}
                  <span>{secs(row.ms)} s</span>
                </div>
                <span className={styles.track} aria-hidden="true">
                  <span className={row.model ? styles.model : undefined} style={{ '--left': row.left, '--width': row.width } as CSSProperties} />
                </span>
                <i>{row.note}</i>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.meta}>Timings arrive with the finished composition.</p>
        )}
      </Section>

      <Section title="GitHub reads" aside={`repos/${repo}`}>
        <p className={styles.meta}>{built ? readsLine(built, served, sample) : 'Reads arrive with the finished composition.'}</p>
        {sources.length > 0 && (
          <ul className={styles.reads}>
            {sources.map(key => (
              <li key={key}>
                <code>{key}</code>
                <i>cited by the insight</i>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="What the model chose" aside={plural(pieces, 'component')}>
        <p className={styles.p}>The model sent meaning only: tone, emphasis and density. Colors, sizes and gaps come from the system; every value comes from the reads above.</p>
        <ul className={styles.picks}>
          <li>
            <b>Screen</b>
            <span className={styles.props}>{tree.density ? <Tag tone="quiet">density {tree.density}</Tag> : <em>defaults</em>}</span>
          </li>
          {picks.map(({ piece, region }) => {
            const chosen = choices(piece)
            return (
              <li key={piece.id}>
                <b>
                  {piece.component}
                  <span>{shortId(piece)}</span>
                </b>
                <span className={styles.props}>{chosen.length > 0 ? chosen.map(c => <Tag key={c} tone="quiet">{c}</Tag>) : <em>defaults</em>}</span>
                <i>
                  {region} region
                  {piece.ask && `${MIDDOT}asks “${piece.ask}”`}
                </i>
              </li>
            )
          })}
        </ul>
      </Section>
    </Sheet>
  )
}

/** A piece's "show all": the full list it could not fit, in the same sheet. */
export function PieceDrawer({ content, onClose }: { content: PieceDrawerContent | null; onClose: () => void }) {
  // The sheet keeps the last content while it leaves.
  const [last, setLast] = useState(content)
  if (content && content !== last) setLast(content)
  const shown = content ?? last
  return (
    <Sheet kind="piece" open={content !== null} onClose={onClose} title={shown?.title ?? ''} sub={shown ? plural(shown.items.length, 'item') : undefined}>
      <Section>
        <ul className={styles.items}>
          {shown?.items.map((item, i) => (
            <li key={`${i}:${item}`}>{item}</li>
          ))}
        </ul>
      </Section>
    </Sheet>
  )
}
