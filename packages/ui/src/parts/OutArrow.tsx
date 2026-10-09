import { cx } from './cx'
import styles from './OutArrow.module.css'

const sha7 = (sha: string) => sha.slice(0, 7)

/**
 * The system's words for where a link out goes, read from the GitHub URL itself: "Open PR #123 on GitHub".
 * `name` is the row's own name, for destinations GitHub addresses by id (a workflow run).
 */
export function githubDestination(href: string, name?: string): string {
  let host: string
  let parts: string[]
  try {
    const url = new URL(href)
    host = url.hostname
    parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  } catch {
    return 'Open on GitHub'
  }
  if (host !== 'github.com') return `Open ${host}`
  const [owner, repo, kind, ...rest] = parts
  if (owner && !repo) return `Open ${owner} on GitHub`
  if (!kind) return owner && repo ? `Open ${owner}/${repo} on GitHub` : 'Open on GitHub'
  const [first, ...tail] = rest
  if (kind === 'pull' && first) return `Open PR #${first} on GitHub`
  if (kind === 'issues' && first) return `Open issue #${first} on GitHub`
  if (kind === 'commit' && first) return `Open commit ${sha7(first)} on GitHub`
  if (kind === 'actions' && first === 'runs' && tail[0]) return `Open run ${name ?? tail[0]} on GitHub`
  if (kind === 'releases' && first === 'tag' && tail[0]) return `Open release ${tail.join('/')} on GitHub`
  if (kind === 'blob' && tail.length) return `Open file ${tail.join('/')} on GitHub`
  if (kind === 'tree' && tail.length) return `Open folder ${tail.join('/')} on GitHub`
  return 'Open on GitHub'
}

/** The trailing arrow-up-right on a row that opens GitHub in a new tab, the glyph the site nav uses. Decorative. */
export function OutArrow({ className }: { className?: string }) {
  return (
    <svg className={cx(styles.arrow, className)} viewBox="0 0 12 12" aria-hidden="true" data-out="">
      <path d="M4 8L8 4" />
      <path d="M4.5 4H8V7.5" />
    </svg>
  )
}

/**
 * Where the link goes, for screen readers, placed last inside the link: the row keeps its title, state and size
 * in its name and the destination follows them.
 */
export function OutWords({ href, name }: { href: string; name?: string }) {
  return <span className="sr-only">. {githubDestination(href, name)}</span>
}
