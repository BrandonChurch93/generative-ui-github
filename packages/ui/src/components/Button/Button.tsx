import type { ReactNode } from 'react'
import styles from './Button.module.css'

type ButtonProps = { variant?: 'primary' | 'secondary'; children: ReactNode } & (
  | { href: string; onClick?: never }
  | { href?: never; onClick?: () => void }
)

/** Primary is the accent gradient; secondary is surface with a line border. Hover lifts 1px. One primary per card. */
export function Button({ variant = 'secondary', children, href, onClick }: ButtonProps) {
  if (href !== undefined) {
    return (
      <a className={styles.button} data-variant={variant} data-piece="Button" href={href}>
        {children}
      </a>
    )
  }
  return (
    <button type="button" className={styles.button} data-variant={variant} data-piece="Button" onClick={onClick}>
      {children}
    </button>
  )
}
