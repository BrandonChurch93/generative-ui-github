import styles from './Avatar.module.css'

/** A person as initials, from their handle. Handles stay mono beside it; the circle is decoration. */
export function Avatar({ handle }: { handle: string }) {
  const letters = handle
    .replace(/\[bot\]$/i, '')
    .split(/[-_.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]!.toUpperCase())
    .join('')
  return (
    <span className={styles.avatar} data-piece="Avatar" aria-hidden="true">
      {letters || '?'}
    </span>
  )
}
