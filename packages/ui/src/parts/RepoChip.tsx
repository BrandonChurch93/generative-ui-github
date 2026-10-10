import { cx } from './cx'
import styles from './RepoChip.module.css'

/** A repository named as data, in mono with no border. With `href` it is interactive and reads as a bordered sans chip. `selected` adds the accent dot. */
export function RepoChip({ repo, href, selected, className }: { repo: string; href?: string; selected?: boolean; className?: string }) {
  const props = { className: cx(styles.chip, className), 'data-selected': selected ? '' : undefined }
  if (href) {
    return (
      <a {...props} href={href} aria-current={selected ? 'true' : undefined}>
        {repo}
      </a>
    )
  }
  return <span {...props}>{repo}</span>
}
