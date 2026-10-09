'use client'

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { CardFrame, Skeleton, SkeletonBlock, StateRow, TextLink } from '../../parts'
import type { PieceRenderProps } from '../../types'
import { splitLines, splitPath, wrapFor, type CodeLine } from './code'
import { revealMotion } from './motion'
import { blobUrl, CODE_LIMIT, CODE_WORDS, FOLD_AT, type CodeBlockProps } from './schema'
import styles from './CodeBlock.module.css'

function Line({ line, focusable }: { line: CodeLine; focusable?: boolean }) {
  return (
    <tr className={styles.line} data-row={line.key} tabIndex={focusable ? -1 : undefined}>
      <td className={styles.num} data-n={line.n} />
      <td className={styles.code} style={{ '--i': line.indent } as CSSProperties}>
        {line.text}
      </td>
    </tr>
  )
}

function Path({ path }: { path: string }) {
  const { dir, name } = splitPath(path)
  return (
    <h2 className={styles.path} data-path="">
      {dir && <span className={styles.dir}>{dir}</span>}
      <span className={styles.name}>{name}</span>
    </h2>
  )
}

// Code-shaped placeholders: a number block in the gutter and code blocks at real indents.
const SKELETON_LINES: { width?: string; indent: number }[] = [
  { width: '34ch', indent: 0 },
  { width: '46ch', indent: 2 },
  { width: '28ch', indent: 4 },
  { width: '40ch', indent: 4 },
  { width: '22ch', indent: 2 },
  { indent: 0 },
  { width: '30ch', indent: 0 },
]

function SkeletonBody() {
  return (
    <div className={styles.lines} aria-hidden="true">
      <table className={styles.table}>
        <tbody>
          {SKELETON_LINES.map((line, i) => (
            <tr key={i} className={styles.line}>
              <td className={styles.skNum}>
                <SkeletonBlock width="2ch" height="calc(var(--text-meta-size) * 0.6)" className={styles.skBlock} />
              </td>
              <td className={styles.skCode} style={{ '--i': line.indent } as CSSProperties}>
                {line.width && <SkeletonBlock width={`min(${line.width}, 100%)`} height="calc(var(--text-code-size) * 0.66)" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CodeBlock({ props, state, error, onRetry }: PieceRenderProps<CodeBlockProps>) {
  const { repo, path, lines: range, caption, text, fileLines } = props
  const { name } = splitPath(path)
  const start = props.start ?? range?.[0] ?? 1
  const lines = useMemo(() => splitLines(text, start), [text, start])
  const wrap = wrapFor(path)

  const [expanded, setExpanded] = useState(false)
  // A rewrite that points the block at another file or other lines starts folded again.
  const shownKey = `${repo}/${path}:${range?.join('-') ?? 'all'}`
  const [seen, setSeen] = useState(shownKey)
  if (seen !== shownKey) {
    setSeen(shownKey)
    setExpanded(false)
  }

  const bodyRef = useRef<HTMLDivElement>(null)
  const revealing = useRef(false)
  useLayoutEffect(() => {
    if (!revealing.current || !expanded) return
    revealing.current = false
    const revealed = [...(bodyRef.current?.querySelectorAll<HTMLElement>('[data-revealed] [data-row]') ?? [])]
    const tl = revealMotion(revealed)
    revealed[0]?.focus()
    return () => void tl.progress(1).kill()
  }, [expanded])

  if (state === 'skeleton' || state === 'warming') {
    return (
      <CardFrame as="figure" busy ariaLabel={path}>
        <span className="sr-only">{CODE_WORDS.loading(name)}</span>
        <div className={styles.head} aria-hidden="true">
          <Skeleton text="code" width="55%" />
          <Skeleton text="meta" width="6rem" className={styles.end} />
        </div>
        <SkeletonBody />
      </CardFrame>
    )
  }

  const empty = state === 'empty' || (state === 'default' && lines.length === 0)
  const shownRange = lines.length ? ([lines[0]!.n, lines.at(-1)!.n] as const) : range
  const rangeWords = shownRange ? CODE_WORDS.range(shownRange[0], shownRange[1]) : undefined
  const url = blobUrl({ ...props, lines: lines.length ? [lines[0]!.n, lines.at(-1)!.n] : undefined })
  const folded = !expanded && lines.length > FOLD_AT
  const hidden = lines.length - FOLD_AT

  const head = (
    <div className={styles.head} data-head="">
      <Path path={path} />
      {(state === 'default' || state === 'empty') && (
        <div className={styles.end}>
          {rangeWords && !empty && (
            <span className={styles.meta} data-range="">
              {range ? rangeWords : CODE_WORDS.count(lines.length)}
            </span>
          )}
          <TextLink href={url} external>
            {CODE_WORDS.viewOnGitHub}
          </TextLink>
        </div>
      )}
    </div>
  )

  const body = () => {
    if (state === 'error') {
      return (
        <StateRow
          kind="error"
          title={error?.failed ?? CODE_WORDS.failed(name)}
          meta={error?.cause}
          action={onRetry && <TextLink onClick={onRetry}>{CODE_WORDS.tryAgain}</TextLink>}
        />
      )
    }
    if (empty) {
      const known = fileLines !== undefined
      const title = !range
        ? CODE_WORDS.emptyFile
        : known && fileLines < range[0]
          ? CODE_WORDS.pastEnd(range[0], range[1])
          : CODE_WORDS.emptyRange
      return <StateRow kind="empty" title={title} meta={range && known ? CODE_WORDS.fileHas(fileLines) : undefined} />
    }
    const scrolls = wrap === 'scroll'
    return (
      <>
        <div
          className={styles.lines}
          data-lines=""
          data-wrap={wrap}
          {...(scrolls ? { role: 'region', tabIndex: 0, 'aria-label': CODE_WORDS.scrolls(name) } : {})}
        >
          <table className={styles.table} data-wrap={wrap}>
            <caption className="sr-only">{CODE_WORDS.caption(name, rangeWords ?? CODE_WORDS.count(lines.length))}</caption>
            <thead className="sr-only">
              <tr>
                {CODE_WORDS.columns.map(column => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.slice(0, FOLD_AT).map(line => (
                <Line key={line.key} line={line} />
              ))}
            </tbody>
            {expanded && lines.length > FOLD_AT && (
              <tbody data-revealed="">
                {lines.slice(FOLD_AT).map((line, i) => (
                  <Line key={line.key} line={line} focusable={i === 0} />
                ))}
              </tbody>
            )}
          </table>
        </div>
        {folded && (
          <div className={styles.fold} data-fold="">
            {lines.length > CODE_LIMIT ? (
              <>
                <span>{CODE_WORDS.overLimit(hidden)}</span>
                <TextLink href={url} external>
                  {CODE_WORDS.viewOnGitHub}
                </TextLink>
              </>
            ) : (
              <>
                <span>{CODE_WORDS.hidden(hidden)}</span>
                <TextLink
                  onClick={() => {
                    revealing.current = true
                    setExpanded(true)
                  }}
                >
                  {CODE_WORDS.showAll}
                </TextLink>
              </>
            )}
          </div>
        )}
      </>
    )
  }

  return (
    <CardFrame as="figure" ariaLabel={path}>
      {head}
      <div ref={bodyRef} data-body="">
        {body()}
      </div>
      {caption && state === 'default' && !empty && (
        <figcaption className={styles.caption} data-caption="">
          {caption}
        </figcaption>
      )}
    </CardFrame>
  )
}
