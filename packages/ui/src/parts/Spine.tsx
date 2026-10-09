import type { CSSProperties } from 'react'
import { cx } from './cx'
import styles from './Spine.module.css'

/**
 * The 1px line Timeline and Steps hang their nodes on. The host places it from its own per-density geometry;
 * by default it runs down the mark column. It draws top to bottom, so its transform origin is the top.
 */
export function Spine({ top, bottom, x, className }: { top: string; bottom: string; x?: string; className?: string }) {
  const style = { '--spine-top': top, '--spine-bottom': bottom, ...(x ? { '--spine-x': x } : {}) } as CSSProperties
  return <span className={cx(styles.spine, className)} style={style} data-spine="" aria-hidden="true" />
}
