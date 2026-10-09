import { parseRepo } from '../landing/repoInput'

// The one piece of visitor state the app keeps (docs/decisions.md, Product): the last repo opened, in this
// browser only, so the landing can offer it again. Storage can refuse or be cleared; nothing depends on it.

const KEY = 'genui:last-repo'
const EVENT = 'genui:last-repo'

/** Remembers `owner/name` (or anything the landing field accepts) as the repo to offer on the next visit. */
export function rememberRepo(repo: string): void {
  const parsed = parseRepo(repo)
  if (!parsed.ok) return
  try {
    localStorage.setItem(KEY, `${parsed.owner}/${parsed.name}`)
  } catch {
    return
  }
  window.dispatchEvent(new Event(EVENT))
}

/** The repo last opened in this browser, as `owner/name`, or undefined. */
export function lastRepo(): string | undefined {
  let stored: string | null
  try {
    stored = localStorage.getItem(KEY)
  } catch {
    return undefined
  }
  const parsed = stored ? parseRepo(stored) : undefined
  return parsed?.ok ? `${parsed.owner}/${parsed.name}` : undefined
}

/** For `useSyncExternalStore`: calls `notify` when the stored repo changes, in this tab or another. */
export function onLastRepoChange(notify: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) notify()
  }
  window.addEventListener(EVENT, notify)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, notify)
    window.removeEventListener('storage', onStorage)
  }
}
