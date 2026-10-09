import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * A directory beside a module, from its `import.meta.url`. Under a browser-like test environment Vitest hands
 * modules an http URL (`/@fs/` for files outside the root), so a file URL cannot be assumed.
 */
export function dirFrom(moduleUrl: string, relative: string): string {
  const url = new URL(relative, moduleUrl)
  if (url.protocol === 'file:') return fileURLToPath(url)
  const path = decodeURIComponent(url.pathname)
  // Only Vitest's browser-like environment lands here; the ignore keeps Next from tracing the whole repo.
  return path.startsWith('/@fs/') ? path.slice(4) : resolve(/*turbopackIgnore: true*/ process.cwd(), `.${path}`)
}
