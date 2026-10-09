import type { TimelineItem } from './schema'

export interface Day {
  /** yyyy-mm-dd in the viewer's zone. */
  key: string
  heading: string
  /** The full date, for the time element and screen readers. */
  full: string
  items: TimelineItem[]
}

const dayKey = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)

/** Groups newest-first items by day in the viewer's zone and writes the headings: Today, Yesterday, then Fri Oct 2. */
export function groupByDay(items: readonly TimelineItem[], now: string, timeZone: string): Day[] {
  const today = dayKey(new Date(now), timeZone)
  const yesterday = dayKey(new Date(new Date(now).getTime() - 86_400_000), timeZone)
  const short = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' })
  const long = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const days = new Map<string, Day>()
  for (const item of items) {
    const date = new Date(item.when)
    const key = dayKey(date, timeZone)
    let day = days.get(key)
    if (!day) {
      const heading = key === today ? 'Today' : key === yesterday ? 'Yesterday' : short.format(date).replace(',', '')
      day = { key, heading, full: long.format(date), items: [] }
      days.set(key, day)
    }
    day.items.push(item)
  }
  return [...days.values()]
}

/** "2h ago", "5d ago", "just now". Written once by the system; it changes in place without motion. */
export function relativeTime(when: string, now: string): string {
  const minutes = Math.max(0, Math.round((new Date(now).getTime() - new Date(when).getTime()) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 14) return `${days}d ago`
  return `${Math.round(days / 7)} weeks ago`
}
