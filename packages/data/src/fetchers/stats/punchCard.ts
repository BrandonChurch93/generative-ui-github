import { createLogger } from '@genui-github/core'
import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { PunchCardShape } from '../../shapes'
import { COUNTING, requestStats, type Counting } from './request'

const log = createLogger('data:stats')

const HOURS_A_WEEK = 7 * 24
const MINUTES_A_WEEK = HOURS_A_WEEK * 60

function emptyWeek(): number[] {
  return Array.from({ length: HOURS_A_WEEK }, () => 0)
}

function toCells(counts: number[], timeZone: string): PunchCardShape {
  return { timeZone, cells: counts.map((commits, i) => ({ day: Math.floor(i / 24), hour: i % 24, commits })) }
}

/** GitHub's `[day, hour, commits]`, Sunday first in UTC, as 168 cells Monday first (day 0 is Monday), still in UTC. */
export function normalizePunchCard(raw: unknown): PunchCardShape {
  const counts = emptyWeek()
  for (const [day, hour, commits] of Array.isArray(raw) ? (raw as [number, number, number][]) : []) {
    const monday = (day + 6) % 7
    counts[monday * 24 + hour] = (counts[monday * 24 + hour] ?? 0) + commits
  }
  return toCells(counts, 'UTC')
}

/** Minutes the zone's wall clock runs ahead of UTC at `at`. */
export function zoneOffsetMinutes(timeZone: string, at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(at)
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === type)?.value)
  const wall = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'))
  return Math.round((wall - Math.floor(at / 60_000) * 60_000) / 60_000)
}

/**
 * Shifts a UTC punch card into `timeZone`. One offset for the whole card, the zone's offset at `at`: the card is
 * an all-time total, so commits on the other side of a DST change land an hour off. In a zone with a half or
 * quarter hour offset, each UTC hour goes to the local hour that holds its midpoint.
 */
export function punchCardInZone(card: PunchCardShape, timeZone: string, at: number): PunchCardShape {
  let offset: number
  try {
    offset = zoneOffsetMinutes(timeZone, at)
  } catch {
    log.warn('Unknown time zone, punch card left in UTC', { timeZone })
    return { ...card, timeZone: 'UTC' }
  }
  const counts = emptyWeek()
  for (const { day, hour, commits } of card.cells) {
    const minute = (((day * 24 + hour) * 60 + 30 + offset) % MINUTES_A_WEEK + MINUTES_A_WEEK) % MINUTES_A_WEEK
    const index = Math.floor(minute / 60)
    counts[index] = (counts[index] ?? 0) + commits
  }
  return toCells(counts, timeZone)
}

export async function fetchPunchCard(client: GitHubClient, repo: RepoRef, timeZone = 'UTC', at = Date.now()): Promise<PunchCardShape | Counting> {
  const raw = await requestStats<[number, number, number][]>(client, repo, 'punch_card')
  return raw === COUNTING ? COUNTING : punchCardInZone(normalizePunchCard(raw), timeZone, at)
}
