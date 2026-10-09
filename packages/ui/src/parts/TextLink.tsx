import type { ReactNode } from 'react'
import { cx } from './cx'
import styles from './TextLink.module.css'

type TextLinkProps = {
  children: ReactNode
  className?: string
  external?: boolean
  /** `hint` for the 12.5px rows inside a Metric's delta line. */
  size?: 'label' | 'hint'
} & ({ href: string; onClick?: never } | { href?: never; onClick: () => void })

/** A text action in `accent-text`: Try again, Show all, Source. The hit area is padded to 36px without moving the layout. */
export function TextLink({ children, className, href, onClick, external, size = 'label' }: TextLinkProps) {
  if (href !== undefined) {
    return (
      <a
        className={cx(styles.link, className)}
        data-size={size}
        href={href}
        {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      >
        {children}
      </a>
    )
  }
  return (
    <button type="button" className={cx(styles.link, className)} data-size={size} onClick={onClick}>
      {children}
    </button>
  )
}
