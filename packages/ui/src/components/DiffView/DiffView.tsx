'use client'

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CardFrame, Mark, Skeleton, SkeletonBlock, StateRow, TextLink } from '../../parts'
import type { PieceRenderProps } from '../../types'
import { foldMotion, revealMotion } from './motion'
import { bodyFor, foldHunks, parsePatch, wrapFor, type DiffLine, type Hunk } from './patch'
import { DIFF_WORDS, formatCount, type DiffViewProps } from './schema'
import styles from './DiffView.module.css'

function splitPath(path: string): { dir: string; name: string } {
  const at = path.lastIndexOf('/')
  return at < 0 ? { dir: '', name: path } : { dir: path.slice(0, at + 1), name: path.slice(at + 1) }
}

/** What a renamed or copied file was: its name alone when it stayed in the same folder. */
function previousName(path: string, previous: string): string {
  const now = splitPath(path)
  const was = splitPath(previous)
  return now.dir === was.dir ? was.name : previous
}

function Code({ line }: { line: DiffLine }) {
  if (!line.marks?.length) return <>{line.text}</>
  const parts: ReactNode[] = []
  let at = 0
  for (const [start, end] of line.marks) {
    if (start > at) parts.push(line.text.slice(at, start))
    parts.push(<mark key={start}>{line.text.slice(start, end)}</mark>)
    at = end
  }
  if (at < line.text.length) parts.push(line.text.slice(at))
  return <>{parts}</>
}

function Line({ line, focusable }: { line: DiffLine; focusable?: boolean }) {
  const sign = line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : undefined
  return (
    <tr
      className={styles.line}
      data-kind={line.kind}
      data-row={line.key}
      data-tint={sign ? '' : undefined}
      tabIndex={focusable ? -1 : undefined}
    >
      <td className={styles.num} data-n={line.old} />
      <td className={styles.num} data-n={line.new} />
      <td className={styles.sign} data-s={sign}>
        {sign && <span className="sr-only">{line.kind === 'add' ? DIFF_WORDS.added : DIFF_WORDS.removed}</span>}
      </td>
      <td className={styles.code} style={{ '--i': line.indent } as CSSProperties}>
        <Code line={line} />
      </td>
    </tr>
  )
}

function HunkHead({ header }: { header: string }) {
  return (
    <tr>
      <th className={styles.hunkHead} colSpan={4} scope="rowgroup" tabIndex={-1}>
        {header}
      </th>
    </tr>
  )
}

function Hunks({ hunks, expanded }: { hunks: Hunk[]; expanded: boolean }) {
  const fold = foldHunks(hunks)
  const groups: ReactNode[] = []
  hunks.forEach((hunk, i) => {
    const shown = fold.shown[i]!
    if (shown > 0) {
      groups.push(
        <tbody key={i} className={styles.hunk} data-hunk={i}>
          <HunkHead header={hunk.header} />
          {hunk.lines.slice(0, shown).map(line => (
            <Line key={line.key} line={line} />
          ))}
        </tbody>,
      )
    }
    if (expanded && shown < hunk.lines.length) {
      const rest = hunk.lines.slice(shown)
      groups.push(
        <tbody key={`${i}+`} className={styles.hunk} data-hunk={i} data-revealed="" data-continued={shown > 0 ? '' : undefined}>
          {shown === 0 && <HunkHead header={hunk.header} />}
          {rest.map((line, k) => (
            <Line key={line.key} line={line} focusable={shown > 0 && k === 0} />
          ))}
        </tbody>,
      )
    }
  })
  return <>{groups}</>
}

// Code-shaped placeholders: number blocks in both gutters and code blocks at real indents.
const SKELETON_LINES: { width?: string; indent: number }[] = [
  { width: '31ch', indent: 0 },
  { width: '44ch', indent: 2 },
  { width: '26ch', indent: 2 },
  { width: '52ch', indent: 2 },
  { width: '28ch', indent: 2 },
  { indent: 0 },
  { width: '46ch', indent: 4 },
]

function SkeletonBody() {
  return (
    <table className={styles.table} aria-hidden="true">
      <tbody className={styles.hunk}>
        <tr>
          <td className={styles.hunkHead} colSpan={4}>
            <Skeleton text="meta" width="45%" />
          </td>
        </tr>
        {SKELETON_LINES.map((line, i) => (
          <tr key={i} className={styles.line}>
            <td className={styles.skNum}>
              <SkeletonBlock width="2ch" height="calc(var(--text-meta-size) * 0.6)" className={styles.skBlock} />
            </td>
            <td className={styles.skNum}>
              <SkeletonBlock width="2ch" height="calc(var(--text-meta-size) * 0.6)" className={styles.skBlock} />
            </td>
            <td className={styles.sign} />
            <td className={styles.skCode} style={{ '--i': line.indent } as CSSProperties}>
              {line.width && <SkeletonBlock width={`min(${line.width}, 100%)`} height="calc(var(--text-code-size) * 0.66)" />}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function DiffView({ props, state, error, onRetry }: PieceRenderProps<DiffViewProps>) {
  const { path, additions, deletions, patch, status, previousPath, emptyTone, emptyMeta, repo, pr } = props
  const { dir, name } = splitPath(path)
  const hunks = useMemo(() => parsePatch(patch), [patch])
  const fold = useMemo(() => foldHunks(hunks), [hunks])
  const kind = state === 'empty' ? 'empty' : bodyFor(props, hunks)
  const wrap = wrapFor(path)

  const [open, setOpen] = useState(props.open ?? true)
  const [closing, setClosing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  // A rewrite that changes `open` or points at another file resets what the reader did to the old one.
  const [seen, setSeen] = useState({ open: props.open, path })
  if (seen.open !== props.open || seen.path !== path) {
    setSeen({ open: props.open, path })
    setOpen(props.open ?? true)
    setClosing(false)
    if (seen.path !== path) setExpanded(false)
  }

  const bodyRef = useRef<HTMLDivElement>(null)
  const chevronRef = useRef<SVGSVGElement>(null)
  const pending = useRef<'open' | 'close' | 'reveal' | null>(null)
  const running = useRef<gsap.core.Timeline | null>(null)

  useLayoutEffect(() => {
    const action = pending.current
    pending.current = null
    if (!action) return
    running.current?.kill()
    if (action === 'reveal') {
      const revealed = [...(bodyRef.current?.querySelectorAll<HTMLElement>('[data-revealed]') ?? [])]
      running.current = revealMotion(revealed)
      revealed[0]?.querySelector<HTMLElement>('th[tabindex], tr[tabindex]')?.focus()
      return
    }
    const tl = foldMotion(bodyRef.current, chevronRef.current, action === 'open' ? 'in' : 'out')
    if (action === 'close') tl.eventCallback('onComplete', () => setClosing(false))
    running.current = tl
  }, [open, expanded])

  useLayoutEffect(() => () => void running.current?.kill(), [])

  const toggle = () => {
    pending.current = open ? 'close' : 'open'
    setClosing(open)
    setOpen(!open)
  }
  const showAll = () => {
    pending.current = 'reveal'
    setExpanded(true)
  }

  if (state === 'skeleton' || state === 'warming') {
    return (
      <CardFrame busy ariaLabel={path}>
        <span className="sr-only">{DIFF_WORDS.loading(name)}</span>
        <div className={styles.head} aria-hidden="true">
          <Skeleton text="code" width="60%" />
          <Skeleton text="tag" width="4rem" className={styles.skCounts} />
        </div>
        <div aria-hidden="true">
          <SkeletonBody />
        </div>
      </CardFrame>
    )
  }

  const changed = additions + deletions
  const showCounts = state !== 'error'
  const showBody = open || closing

  const body = () => {
    if (state === 'error') {
      return (
        <StateRow
          kind="error"
          title={error?.failed ?? DIFF_WORDS.failed}
          meta={error?.cause}
          action={onRetry && <TextLink onClick={onRetry}>{DIFF_WORDS.tryAgain}</TextLink>}
        />
      )
    }
    if (kind === 'empty') {
      const meta = [previousPath && DIFF_WORDS.was(previousName(path, previousPath)), emptyMeta].filter(Boolean).join(' · ')
      return <StateRow kind="empty" emptyTone={emptyTone ?? 'neutral'} title={DIFF_WORDS.empty[status]} meta={meta || undefined} />
    }
    if (kind === 'limit' || kind === 'omitted' || kind === 'binary') {
      const meta = kind === 'limit' ? DIFF_WORDS.overLimit(changed) : kind === 'omitted' ? DIFF_WORDS.omitted(changed) : DIFF_WORDS.binaryMeta
      return (
        <div className={styles.message} data-message="">
          <Mark kind="neutral" className={styles.messageMark} />
          <div className={styles.messageText}>
            <div className={styles.messageLine}>
              <span className={styles.messageTitle}>{kind === 'binary' ? DIFF_WORDS.binary : DIFF_WORDS.tooLarge}</span>
              <TextLink href={props.url ?? `https://github.com/${repo}/pull/${pr}/files`} external>
                {DIFF_WORDS.viewOnGitHub}
              </TextLink>
            </div>
            <span className={styles.messageMeta}>{meta}</span>
          </div>
        </div>
      )
    }
    const scrolls = wrap === 'scroll'
    return (
      <>
        <div
          className={styles.lines}
          data-wrap={wrap}
          {...(scrolls ? { role: 'region', tabIndex: 0, 'aria-label': DIFF_WORDS.scrolls(name) } : {})}
        >
          <table className={styles.table} data-wrap={wrap}>
            <caption className="sr-only">{DIFF_WORDS.caption(name)}</caption>
            <thead className="sr-only">
              <tr>
                {DIFF_WORDS.columns.map(column => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <Hunks hunks={hunks} expanded={expanded} />
          </table>
        </div>
        {!expanded && fold.hiddenLines > 0 && (
          <div className={styles.fold} data-fold="">
            <span>{DIFF_WORDS.hidden(fold.hiddenLines, fold.hiddenHunks)}</span>
            <TextLink onClick={showAll}>{DIFF_WORDS.showAll}</TextLink>
          </div>
        )}
      </>
    )
  }

  return (
    <CardFrame ariaLabel={path}>
      <div className={styles.head} data-folded={showBody ? undefined : ''}>
        <button type="button" className={styles.toggle} aria-expanded={open} onClick={toggle}>
          <svg ref={chevronRef} className={styles.chevron} viewBox="0 0 12 12" aria-hidden="true">
            <path d="M4.5 2.5 8 6 4.5 9.5" />
          </svg>
          <span className={styles.path} data-path="">
            {dir && <span className={styles.dir}>{dir}</span>}
            <span className={styles.name}>{name}</span>
          </span>
        </button>
        {showCounts && (
          <span className={styles.counts}>
            <span className={styles.figures} aria-hidden="true">
              <span className={styles.add} data-count="add" data-zero={additions === 0 || undefined}>
                +{formatCount(additions)}
              </span>
              <span className={styles.del} data-count="del" data-zero={deletions === 0 || undefined}>
                {'−'}
                {formatCount(deletions)}
              </span>
            </span>
            <span className="sr-only">{DIFF_WORDS.counts(additions, deletions)}</span>
          </span>
        )}
      </div>
      {showBody && (
        <div ref={bodyRef} data-body="" data-kind={state === 'error' ? 'error' : kind}>
          {body()}
        </div>
      )}
    </CardFrame>
  )
}
