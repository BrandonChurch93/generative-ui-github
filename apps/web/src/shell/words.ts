import { MODELS } from '@genui-github/core'
import type { Built, Regions } from '@genui-github/renderer'

// The shell's own words for what the system did. The model never writes any of these.

export const MIDDOT = ' · '

export function modelName(id: string): string {
  if (id === MODELS.haiku || id.includes('haiku')) return 'Haiku'
  if (id === MODELS.sonnet || id.includes('sonnet')) return 'Sonnet'
  return 'the templates'
}

export const plural = (n: number, word: string, many = `${word}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? word : many}`

export const pieceCount = (regions: Regions) => Object.values(regions).reduce((n, list) => n + list.length, 0)

/** Seconds with one decimal, as the built block and the strip print them. */
export const seconds = (ms: number) => Math.round(ms / 100) / 10

export function templateLine(built: Built): string {
  if (built.template === 'off-template') return built.reason ? `off-template${MIDDOT}${built.reason}` : 'off-template'
  return `template ${built.template}`
}

/** "just now", "4m ago", "3h ago", "2d ago": how long since an instant, for the eyebrow and the cache chip. */
export function ago(iso: string | number, now = Date.now()): string {
  const ms = now - (typeof iso === 'number' ? iso : Date.parse(iso))
  if (!Number.isFinite(ms) || ms < 60_000) return 'just now'
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/** A wall-clock time in the reader's zone with the zone named: "17:58 UTC". */
export function clock(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone, timeZoneName: 'short' }).format(new Date(iso))
}

/** "Oct 9": the day a sample's data was read. */
export const day = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(iso))
