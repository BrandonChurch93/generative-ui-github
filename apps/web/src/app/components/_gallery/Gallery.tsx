'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { AnimatePresence, LayoutGroup, usePresence } from 'motion/react'
import { CATALOG, catalogEntry, type CatalogEntry, type CatalogGroup } from '@genui-github/ui/catalog'
import { Conductor } from '@genui-github/renderer'
import { prefersReducedMotion } from '@genui-github/ui/motion'
import { DENSITIES, Segmented, type Density } from '@genui-github/ui'
import { Card, type CardHandle } from './Card'
import { CATEGORIES, DENSITY_LABELS, inCategory, isStill, onScreen, STAGGER } from './stage'
import styles from './gallery.module.css'

const FOUNDATIONS = [
  { href: '/components/parts', label: 'Parts' },
  { href: '/components/density', label: 'Density' },
  { href: '/components/motion', label: 'Motion' },
]

const PICKABLE = CATALOG.filter(e => e.spec?.pickable).length

/** Arrow keys belong to whatever has focus when it already uses them. */
const TEXT_FIELD = 'input, textarea, select, [contenteditable="true"]'
const OWNS_ARROWS = '[role="radiogroup"], [role="tablist"], [role="listbox"], [role="menu"], [role="slider"], [role="grid"], [role="tree"], [role="treegrid"]'

const entryAt = (pathname: string | null): CatalogEntry | undefined => {
  const name = pathname?.match(/^\/components\/([^/]+)$/)?.[1]
  return name ? catalogEntry(decodeURIComponent(name)) : undefined
}

/** Starts the set's clock before any card registers its moves: it renders first, so its effect runs first. */
function Clock({ conductor }: { conductor: Conductor }) {
  useLayoutEffect(() => {
    conductor.begin()
  }, [conductor])
  return null
}

interface GridProps {
  entries: CatalogEntry[]
  density: Density
  focused: string | null
  conductor: Conductor
  /** This set is the one the server drew. */
  server: boolean
  onToggle: (name: string) => void
  onMounted: (key: string) => void
  onLeft: (height: number) => void
  setKey: string
  stage: RefObject<HTMLDivElement | null>
}

/** One composed set: a category at a density. A switch, a replay or a density change replaces the whole set. */
function Grid({ entries, density, focused, conductor, server, onToggle, onMounted, onLeft, setKey, stage }: GridProps) {
  const [isPresent, safeToRemove] = usePresence()
  const handles = useRef(new Map<string, CardHandle>())
  const leaving = useRef(false)
  // The cards of the first render are the set's own; a card the filter brings back later is a newcomer.
  const names = entries.map(e => e.name).join(' ')
  const [drawn] = useState(() => new Set(server ? entries.map(e => e.name) : []))
  const [present, setPresent] = useState(names)
  const [added, setAdded] = useState<string[]>([])
  if (names !== present) {
    const was = new Set(present.split(' '))
    setPresent(names)
    setAdded(entries.map(e => e.name).filter(n => !was.has(n)))
  }

  useLayoutEffect(() => {
    onMounted(setKey)
    // The set's key never changes: a new key is a new grid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const register = useCallback((name: string, handle: CardHandle | null) => {
    if (handle) handles.current.set(name, handle)
    else handles.current.delete(name)
  }, [])

  // The set leaves top to bottom, the reverse of its entrance; cards out of sight leave at once.
  useLayoutEffect(() => {
    if (isPresent) return
    leaving.current = true
    conductor.begin()
    const height = stage.current?.getBoundingClientRect().height ?? 0
    let order = 0
    const waits = entries.map(e => {
      const handle = handles.current.get(e.name)
      const cell = stage.current?.querySelector(`[data-entry="${e.name}"]`)
      const visible = cell ? onScreen(cell) : false
      return handle?.exit(visible && !isStill() ? order++ * STAGGER : null) ?? Promise.resolve()
    })
    void Promise.all(waits).finally(() => {
      onLeft(height)
      safeToRemove?.()
    })
    // Only the change of presence starts the exit; the set it reads is the one that is leaving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent])

  return (
    <div className={styles.grid} data-density={density} data-ground="bg">
      <Clock conductor={conductor} />
      <LayoutGroup>
        <AnimatePresence mode="popLayout">
          {entries.map((entry, index) => {
            const late = added.indexOf(entry.name)
            return (
              <Card
                key={entry.name}
                entry={entry}
                delay={(late >= 0 ? late : index) * STAGGER}
                prerendered={drawn.has(entry.name) && late < 0}
                focused={focused === entry.name}
                conductor={conductor}
                leaving={leaving}
                register={register}
                onToggle={onToggle}
              />
            )
          })}
        </AnimatePresence>
      </LayoutGroup>
    </div>
  )
}

export function Gallery() {
  const pathname = usePathname()
  const router = useRouter()
  const routed = entryAt(pathname)
  const [category, setCategory] = useState<CatalogGroup>(routed?.group ?? CATEGORIES[0]!)
  const [focused, setFocused] = useState<string | null>(routed?.name ?? null)
  const [density, setDensity] = useState<Density>('comfortable')
  const [run, setRun] = useState(0)
  const [query, setQuery] = useState('')
  const [phase, setPhase] = useState<'composing' | 'settled'>('composing')
  const [conductor] = useState(() => new Conductor({ onPhase: setPhase }))
  const [shown, setShown] = useState<string | null>(null)
  const [held, setHeld] = useState<number | null>(null)
  const [firstSetMounted, setFirstSetMounted] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const refocus = useRef<string | null>(null)

  // What stays on screen above the set: the whole bar, or on a phone only its categories.
  const stuckHeight = () => {
    const el = bar.current && getComputedStyle(bar.current).display === 'contents' ? scroller.current : bar.current
    return el?.offsetHeight ?? 0
  }
  const filterId = useId()

  const needle = query.trim().toLowerCase()
  const entries = inCategory(category).filter(e => e.name.toLowerCase().includes(needle))
  const setKey = `${category}:${density}:${run}`

  // The address follows the open card without a navigation: the set stays composed and the page keeps its scroll.
  const address = useCallback(
    (name: string | null) => {
      router.replace(`${name ? `/components/${encodeURIComponent(name)}` : '/components'}${window.location.search}`, { scroll: false })
    },
    [router],
  )

  // Back, forward or a link to another card while this page is open.
  const [path, setPath] = useState(pathname)
  if (pathname !== path) {
    setPath(pathname)
    if (routed) {
      setFocused(routed.name)
      setCategory(routed.group)
    } else if (pathname === '/components') setFocused(null)
  }

  const toggle = useCallback(
    (name: string) => {
      const next = focused === name ? null : name
      if (!next) refocus.current = name
      setFocused(next)
      address(next)
    },
    [focused, address],
  )

  const choose = useCallback(
    (next: CatalogGroup) => {
      if (next === category) return
      setCategory(next)
      setFocused(null)
      if (pathname !== '/components') address(null)
    },
    [category, pathname, address],
  )

  // An open card takes a row of its own, so it may land below the fold, and a deep link opens on its card: the page
  // scrolls only when the card would be out of sight.
  const loaded = useRef(false)
  useEffect(() => {
    const landing = !loaded.current
    loaded.current = true
    if (!focused) return
    const cell = stage.current?.querySelector<HTMLElement>(`[data-entry="${focused}"]`)
    if (!cell) return
    let top = 0
    for (let el: HTMLElement | null = cell; el; el = el.offsetParent as HTMLElement | null) top += el.offsetTop
    const under = stuckHeight()
    const view = top - window.scrollY
    if (view >= under && view < window.innerHeight * 0.6) return
    const gap = parseFloat(getComputedStyle(cell).getPropertyValue('--space-4')) || 0
    window.scrollTo({ top: top - under - gap, behavior: landing || prefersReducedMotion() ? 'instant' : 'smooth' })
  }, [focused])

  useEffect(() => {
    if (focused || !refocus.current) return
    const name = refocus.current
    refocus.current = null
    stage.current?.querySelector<HTMLElement>(`[data-entry="${name}"] [data-card-button]`)?.focus({ preventScroll: true })
  }, [focused])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      const target = event.target instanceof Element ? event.target : null
      if (document.querySelector('[role="dialog"]') || target?.closest(TEXT_FIELD)) return
      if (event.key === 'Escape' && focused) {
        event.preventDefault()
        toggle(focused)
        return
      }
      if (target?.closest(OWNS_ARROWS) || (target && target.scrollWidth > target.clientWidth)) return
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (!step) return
      event.preventDefault()
      const at = CATEGORIES.indexOf(category)
      choose(CATEGORIES[(at + step + CATEGORIES.length) % CATEGORIES.length]!)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [category, focused, toggle, choose])

  // The old set held the page's height while it left; the new one starts at the top of the stage, under the bar.
  const onLeft = useCallback((height: number) => {
    setHeld(height)
    const top = stage.current?.getBoundingClientRect().top ?? 0
    const under = stuckHeight()
    if (top < under) window.scrollBy({ top: top - under, behavior: 'instant' })
  }, [])

  const onMounted = useCallback((key: string) => {
    setFirstSetMounted(true)
    setShown(key)
    setHeld(null)
  }, [])

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>
          <span>{CATALOG.length} components</span>
          <span aria-hidden="true">·</span>
          <span>{PICKABLE} pickable</span>
          <span aria-hidden="true">·</span>
          <span>rendered from sample JSON</span>
        </p>
        <h1 className={styles.headline}>Every piece the composer can pick</h1>
        <p className={styles.lead}>Pick a category and watch every component in it compose from its sample data. Click one to see all five of its states.</p>
        <nav className={styles.foundations} aria-label="Foundations">
          <span className={styles.factLabel}>Foundations</span>
          {FOUNDATIONS.map(f => (
            <Link key={f.href} href={f.href} className={styles.foundation}>
              {f.label}
            </Link>
          ))}
        </nav>
      </header>
      <div ref={bar} className={styles.bar} data-testid="components-bar">
        <div ref={scroller} className={styles.scroller}>
          <Segmented
            label="Category"
            value={category}
            onChange={choose}
            options={CATEGORIES.map(group => ({
              value: group,
              label: (
                <>
                  {group} <span className={styles.count}>{inCategory(group).length}</span>
                </>
              ),
            }))}
          />
        </div>
        <div className={styles.controls}>
          <Segmented label="Density" value={density} onChange={setDensity} options={DENSITIES.map(d => ({ value: d, label: DENSITY_LABELS[d] }))} />
          <button type="button" className={styles.pill} onClick={() => setRun(r => r + 1)}>
            Replay
          </button>
          <div className={styles.filter}>
            <label className="sr-only" htmlFor={filterId}>
              Filter {category} components
            </label>
            <input
              id={filterId}
              className={styles.filterField}
              type="search"
              placeholder={`Filter ${category}`}
              value={query}
              onChange={event => setQuery(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>
      </div>
      <div
        ref={stage}
        className={styles.stage}
        data-phase={shown === setKey ? phase : 'composing'}
        data-category={category}
        style={held === null ? undefined : ({ '--held': `${held}px` } as CSSProperties)}
      >
        <AnimatePresence mode="wait">
          <Grid
            key={setKey}
            entries={entries}
            density={density}
            focused={focused}
            conductor={conductor}
            server={!firstSetMounted}
            onToggle={toggle}
            onMounted={onMounted}
            onLeft={onLeft}
            setKey={setKey}
            stage={stage}
          />
        </AnimatePresence>
        <p className={styles.none} role="status">
          {entries.length === 0 ? `Nothing in ${category} matches ${query.trim()}` : ''}
        </p>
      </div>
    </div>
  )
}
