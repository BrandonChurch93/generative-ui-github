import { cx } from './cx'
import styles from './RepoChip.module.css'

/** A repository named in mono, as an identifier. `selected` marks the preselected sample with the accent. */
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
