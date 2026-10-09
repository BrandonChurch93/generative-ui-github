import type { ReactNode } from 'react'
import { cx } from './cx'
import styles from './TextLink.module.css'

type TextLinkProps = {
  children: ReactNode
  className?: string
  external?: boolean
} & ({ href: string; onClick?: never } | { href?: never; onClick: () => void })

/** A text action in `accent-text`: Try again, Show all, Source. The hit area is padded to 36px without moving the layout. */
export function TextLink({ children, className, href, onClick, external }: TextLinkProps) {
  if (href !== undefined) {
    return (
      <a
        className={cx(styles.link, className)}
        href={href}
        {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      >
        {children}
      </a>
    )
  }
  return (
    <button type="button" className={cx(styles.link, className)} onClick={onClick}>
      {children}
    </button>
  )
}
