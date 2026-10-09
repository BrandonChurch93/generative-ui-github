'use client'

import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { createLogger } from '@genui-github/core'
import { MOVES } from '../../motion'
import { CardFrame, OutArrow, OutWords, Skeleton, SkeletonBlock, StateRow, TextLink } from '../../parts'
import { cx } from '../../parts/cx'
import type { PieceRenderProps } from '../../types'
import { foldClose, foldOpen } from './motion'
import { WORDS, type FileTreeProps } from './schema'
import {
  buildTree,
  capFiles,
  countWidths,
  defaultOpen,
  fileWords,
  findFile,
  formatAdd,
  formatDel,
  formatWhole,
  middleTruncate,
  visibleRows,
  type TreeFile,
  type TreeFolder,
  type TreeNode,
} from './tree'
import styles from './FileTree.module.css'

const log = createLogger('ui:filetree')

const PROBE = '0000000000'
const ARRIVE: [number, number, number, number] = [0.25, 1, 0.5, 1]

const SKELETON_ROWS = [
  { depth: 0, width: '12ch', file: false },
  { depth: 1, width: '15ch', file: true },
  { depth: 1, width: '11ch', file: true },
  { depth: 0, width: '18ch', file: false },
  { depth: 1, width: '9ch', file: false },
  { depth: 2, width: '10ch', file: true },
  { depth: 2, width: '14ch', file: true },
  { depth: 1, width: '13ch', file: true },
]

const svg = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={styles.chevron} data-chevron="" data-open={open || undefined} viewBox="0 0 12 12" {...svg}>
      <path d="M4.5 2.5 8 6 4.5 9.5" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 16 16" {...svg}>
      <path d="M2.25 4.25a1 1 0 0 1 1-1h2.9l1.5 1.5h5.1a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9.5a1 1 0 0 1-1-1z" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 16 16" {...svg}>
      <path d="M4.25 2.25h4.5l3 3v8.5h-7.5z" />
      <path d="M8.75 2.25v3h3" />
    </svg>
  )
}

function Name({ node, max }: { node: TreeNode; max?: number }) {
  const cut = max === undefined ? null : middleTruncate(node.name, max, node.kind)
  return (
    <span className={styles.name} data-name={node.path} title={cut ? node.name : undefined}>
      {cut ? (
        <>
          <span aria-hidden="true">
            {cut.head}
            <i className={styles.gap}>…</i>
            {cut.tail}
          </span>
          <span className="sr-only">{node.name}</span>
        </>
      ) : (
        node.name
      )}
    </span>
  )
}

/** Additions and deletions in two right-aligned slots; the words are for screen readers. */
function Counts({ id, additions, deletions, style }: { id: string; additions: number; deletions: number; style?: CSSProperties }) {
  return (
    <span className={styles.counts} style={style} data-counts="">
      <span aria-hidden="true" className={styles.add} data-zero={additions === 0 || undefined} data-count={`${id}:add`} data-value={additions} data-sign="+">
        {formatAdd(additions)}
      </span>
      <span aria-hidden="true" className={styles.del} data-zero={deletions === 0 || undefined} data-count={`${id}:del`} data-value={deletions} data-sign={'−'}>
        {formatDel(deletions)}
      </span>
      <span className="sr-only">
        {`, ${WORDS.additions(additions)}, ${WORDS.deletions(deletions)}`}
      </span>
    </span>
  )
}

function FileCount({ id, files }: { id: string; files: number }) {
  return (
    <span className={styles.files} data-counts="">
      <span aria-hidden="true" data-count={`${id}:files`} data-value={files}>
        {formatWhole(files)}
      </span>
      <span className="sr-only">{`, ${fileWords(files)}`}</span>
    </span>
  )
}

function SkeletonTree() {
  return (
    <div className={styles.tree} aria-hidden="true">
      {SKELETON_ROWS.map((row, i) => (
        <div key={i} className={cx(styles.row, styles.skeletonRow)} style={{ '--d': row.depth } as CSSProperties}>
          <span className={styles.slot} />
          <SkeletonBlock width="var(--space-4)" height="var(--space-3)" className={styles.skeletonIcon} />
          <SkeletonBlock width={row.width} height="var(--space-2)" />
          {row.file && <SkeletonBlock width="calc(var(--space-8) - var(--space-3))" height="calc(var(--text-tag-size) * 0.72)" className={styles.skeletonCounts} />}
        </div>
      ))}
    </div>
  )
}

export function FileTree({ props, state, error, onAsk, onRetry }: PieceRenderProps<FileTreeProps>) {
  const { repo, mode, pr, title, selected, open, emptyTone, emptyMeta, totals } = props
  const capsuleId = useId()
  const reduced = useReducedMotion() ?? false

  const model = useMemo(() => {
    const { files, truncated } = capFiles(props.files)
    const nodes = buildTree(files)
    const total = Math.max(props.total ?? 0, props.files.length)
    const chosen = selected && findFile(nodes, selected) ? selected : undefined
    if (selected && !chosen) log.warn('selected file is not in the tree', { selected })
    return {
      nodes,
      shown: files.length,
      total,
      truncated: truncated || total > files.length,
      chosen,
      opens: defaultOpen(nodes, { fileCount: files.length, selected: chosen, open }),
    }
  }, [props.files, props.total, selected, open])

  // The reader's own opens and closes, over the defaults.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [seenSelected, setSeenSelected] = useState(model.chosen)
  if (seenSelected !== model.chosen) {
    setSeenSelected(model.chosen)
    const chosen = model.chosen
    if (chosen) setOverrides(o => Object.fromEntries(Object.entries(o).filter(([path]) => !chosen.startsWith(`${path}/`))))
  }
  const isOpen = (path: string) => overrides[path] ?? model.opens.has(path)

  // Closing groups stay mounted, inert, until their rows have slid out.
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set())
  const [focusKey, setFocusKey] = useState<string | undefined>(undefined)
  const [fit, setFit] = useState<Record<string, number>>({})

  const treeRef = useRef<HTMLUListElement>(null)
  const probeRef = useRef<HTMLSpanElement>(null)
  const rowEls = useRef(new Map<string, HTMLElement>())
  const groupEls = useRef(new Map<string, HTMLElement>())
  const folds = useRef(new Map<string, gsap.core.Timeline>())
  const pendingFold = useRef<{ path: string; open: boolean } | null>(null)

  const visible = visibleRows(model.nodes, isOpen)
  const openKey = visible.map(r => r.node.path).join('\n')
  const tabbable =
    visible.find(r => r.node.path === focusKey)?.node.path ??
    visible.find(r => r.node.path === model.chosen)?.node.path ??
    visible[0]?.node.path

  // A toggle always flips an override, so this runs once per open or close, after the group mounts.
  useLayoutEffect(() => {
    const fold = pendingFold.current
    if (!fold) return
    pendingFold.current = null
    folds.current.get(fold.path)?.kill()
    const group = groupEls.current.get(fold.path)
    if (!group) {
      setLeaving(s => without(s, fold.path))
      return
    }
    const row = rowEls.current.get(fold.path) ?? null
    if (fold.open) {
      folds.current.set(fold.path, foldOpen(group, row, { reduced }))
      return
    }
    const tl = foldClose(group, row, { reduced })
    tl.eventCallback('onComplete', () => setLeaving(s => without(s, fold.path)))
    folds.current.set(fold.path, tl)
  }, [overrides, reduced])

  useLayoutEffect(() => {
    const running = folds.current
    return () => running.forEach(tl => tl.kill())
  }, [])

  // Mono makes the fit exact: each name's room divided by one character's advance.
  useLayoutEffect(() => {
    const root = treeRef.current
    const probe = probeRef.current
    if (!root || !probe) return
    const measure = () => {
      const advance = probe.getBoundingClientRect().width / PROBE.length
      if (!advance) return
      const next: Record<string, number> = {}
      for (const el of root.querySelectorAll<HTMLElement>('[data-name]')) next[el.dataset.name ?? ''] = Math.floor(el.clientWidth / advance)
      setFit(prev => (sameFit(prev, next) ? prev : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [state, openKey])

  const toggle = (folder: TreeFolder) => {
    const next = !isOpen(folder.path)
    setOverrides(o => ({ ...o, [folder.path]: next }))
    setLeaving(s => (next ? without(s, folder.path) : new Set(s).add(folder.path)))
    pendingFold.current = { path: folder.path, open: next }
  }

  const focusRow = (path: string | undefined) => {
    if (path === undefined) return
    setFocusKey(path)
    rowEls.current.get(path)?.focus()
  }

  const onKey = (event: KeyboardEvent<HTMLElement>, node: TreeNode) => {
    const i = visible.findIndex(r => r.node.path === node.path)
    const row = visible[i]
    if (!row) return
    const folderOpen = node.kind === 'folder' && isOpen(node.path)
    switch (event.key) {
      case 'ArrowDown':
        focusRow(visible[i + 1]?.node.path)
        break
      case 'ArrowUp':
        focusRow(visible[i - 1]?.node.path)
        break
      case 'Home':
        focusRow(visible[0]?.node.path)
        break
      case 'End':
        focusRow(visible[visible.length - 1]?.node.path)
        break
      case 'ArrowRight':
        if (node.kind !== 'folder') return
        if (!folderOpen) toggle(node)
        else focusRow(node.children[0]?.path)
        break
      case 'ArrowLeft':
        if (folderOpen) toggle(node as TreeFolder)
        else focusRow(row.parent || undefined)
        break
      default:
        return
    }
    event.preventDefault()
  }

  const rowProps = (node: TreeNode) => ({
    'data-row': node.path,
    tabIndex: node.path === tabbable ? 0 : -1,
    style: { '--d': node.depth } as CSSProperties,
    ref: (el: HTMLElement | null) => {
      if (el) rowEls.current.set(node.path, el)
      else rowEls.current.delete(node.path)
    },
    onFocus: () => setFocusKey(node.path),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => onKey(event, node),
  })

  const fallbackHref = (file: TreeFile) =>
    mode === 'changes' ? `https://github.com/${repo}/pull/${pr}/files` : `https://github.com/${repo}/blob/HEAD/${file.path}`

  const renderFile = (file: TreeFile) => {
    const isSelected = file.path === model.chosen
    const href = file.href ?? fallbackHref(file)
    const asks = file.ask !== undefined && onAsk !== undefined
    const out = !asks && !href.startsWith('#')
    const onClick = asks
      ? (event: MouseEvent<HTMLAnchorElement>) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          onAsk(file.ask!)
        }
      : undefined
    return (
      <li key={file.path}>
        <a
          {...rowProps(file)}
          className={cx(styles.row, isSelected && styles.selected)}
          href={href}
          aria-current={isSelected ? 'true' : undefined}
          onClick={onClick}
          data-external={out || undefined}
          {...(href.startsWith('#') ? {} : { target: '_blank', rel: 'noreferrer' })}
        >
          {isSelected && (
            <motion.span
              layoutId={capsuleId}
              className={styles.capsule}
              transition={reduced ? { duration: 0 } : { duration: MOVES.slide.in, ease: ARRIVE }}
              aria-hidden="true"
            />
          )}
          <span className={styles.slot} />
          <FileIcon />
          <Name node={file} max={fit[file.path]} />
          {out && <OutArrow className={styles.out} />}
          {mode === 'changes' && <Counts id={file.path} additions={file.additions} deletions={file.deletions} />}
          {out && <OutWords href={href} />}
        </a>
      </li>
    )
  }

  const renderFolder = (folder: TreeFolder) => {
    const expanded = isOpen(folder.path)
    const mounted = expanded || leaving.has(folder.path)
    return (
      <li key={folder.path}>
        <button {...rowProps(folder)} type="button" className={cx(styles.row, styles.folder)} aria-expanded={expanded} onClick={() => toggle(folder)}>
          <Chevron open={expanded} />
          <FolderIcon />
          <Name node={folder} max={fit[folder.path]} />
          {!expanded &&
            (mode === 'changes' ? (
              <Counts id={folder.path} additions={folder.additions} deletions={folder.deletions} />
            ) : (
              <FileCount id={folder.path} files={folder.files} />
            ))}
        </button>
        {mounted && (
          <div
            className={styles.group}
            style={{ '--pd': folder.depth } as CSSProperties}
            inert={!expanded}
            data-group={folder.path}
            ref={el => {
              if (el) groupEls.current.set(folder.path, el)
              else groupEls.current.delete(folder.path)
            }}
          >
            <span className={styles.guide} data-guide="" aria-hidden="true" />
            <ul className={styles.list}>{folder.children.map(renderNode)}</ul>
          </div>
        )}
      </li>
    )
  }

  const renderNode = (node: TreeNode): ReactNode => (node.kind === 'folder' ? renderFolder(node) : renderFile(node))

  const skeleton = state === 'skeleton' || state === 'warming'
  const isEmpty = state === 'empty' || (state === 'default' && model.shown === 0)
  const live = state === 'default' && !isEmpty
  const widths = countWidths(model.nodes, totals)
  const columns = { '--aw': `${widths.add}ch`, '--dw': `${widths.del}ch`, '--fw': `${widths.files}ch` } as CSSProperties
  const headTotals = totals ?? (model.truncated ? undefined : { additions: sum(model.nodes, 'additions'), deletions: sum(model.nodes, 'deletions') })

  const meta = skeleton ? (
    <Skeleton text="meta" width="5.25rem" />
  ) : state === 'error' ? (
    pr !== undefined ? `#${pr}` : undefined
  ) : isEmpty ? (
    fileWords(0)
  ) : (
    fileWords(model.total)
  )

  return (
    <CardFrame
      as="div"
      className={styles.card}
      title={skeleton ? <Skeleton text="card-title" width="6.5rem" /> : title}
      meta={meta}
      headerEnd={live && mode === 'changes' && headTotals ? <Counts id="total" additions={headTotals.additions} deletions={headTotals.deletions} style={columns} /> : undefined}
      busy={skeleton}
      ariaLabel={skeleton ? `Loading ${title}` : undefined}
    >
      <div className={styles.body} style={columns}>
        {skeleton && (
          <>
            <SkeletonTree />
            <span className="sr-only">Loading {title}.</span>
          </>
        )}
        {live && (
          <nav aria-label={title}>
            <span ref={probeRef} className={styles.probe} aria-hidden="true">
              {PROBE}
            </span>
            <ul ref={treeRef} className={cx(styles.list, styles.tree)}>
              {model.nodes.map(renderNode)}
            </ul>
            {model.truncated && (
              <p className={styles.note} data-cap="">
                {WORDS.capped(mode, model.shown, model.total)}
              </p>
            )}
          </nav>
        )}
        {isEmpty && <StateRow kind="empty" emptyTone={emptyTone ?? 'neutral'} title={WORDS.empty[mode]} meta={emptyMeta} />}
        {state === 'error' && (
          <StateRow
            kind="error"
            title={error?.failed ?? WORDS.failed}
            meta={error?.cause}
            action={onRetry && <TextLink onClick={onRetry}>Try again</TextLink>}
          />
        )}
      </div>
    </CardFrame>
  )
}

function without(set: ReadonlySet<string>, key: string): ReadonlySet<string> {
  if (!set.has(key)) return set
  const next = new Set(set)
  next.delete(key)
  return next
}

function sameFit(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = Object.keys(b)
  return keys.length === Object.keys(a).length && keys.every(k => a[k] === b[k])
}

function sum(nodes: readonly TreeNode[], key: 'additions' | 'deletions'): number {
  return nodes.reduce((total, node) => total + node[key], 0)
}
