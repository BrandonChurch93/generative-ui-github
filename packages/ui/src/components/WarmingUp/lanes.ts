import { CHECK_SCHEDULE, type WarmingUpProps } from './schema'

type Stat = WarmingUpProps['stats'][number]

export const LAST_CHECK = Math.max(...CHECK_SCHEDULE)

/** The axis starts at 30s, doubles to 60s once the clock passes 25s and to 120s once it passes 50s. */
const AXES = [
  { max: 30, until: 25, ticks: [0, 10, 20, 30] },
  { max: 60, until: 50, ticks: [0, 15, 30, 45, 60] },
  { max: 120, until: Infinity, ticks: [0, 30, 60, 90, 120] },
] as const

export type Axis = (typeof AXES)[number]

export function axisFor(seconds: number): Axis {
  return AXES.find(a => seconds < a.until) ?? AXES[2]
}

/** Seconds from the first request to `iso`, kept on the axis. */
export function secondsAt(iso: string, startedAt: string): number {
  const s = (Date.parse(iso) - Date.parse(startedAt)) / 1000
  return Number.isFinite(s) ? Math.min(LAST_CHECK, Math.max(0, s)) : 0
}

export interface Lane {
  /** A settled lane has stopped: its line ends where the statistic landed, or at the last check. */
  settled: boolean
  /** Where a settled line ends, in seconds. A counting line ends at the running clock instead. */
  end: number | null
  /** One segment per wait. A null end is the open segment, which runs with the clock. */
  segments: [number, number | null][]
}

/** One wait per segment: a gap opens at every check, so the backoff reads at a glance. */
export function laneFor(stat: Stat, status: Pick<WarmingUpProps, 'attempt' | 'phase' | 'startedAt'>): Lane {
  if (stat.state === 'counting' && status.phase === 'warming') {
    const checks = CHECK_SCHEDULE.slice(0, Math.max(1, Math.min(status.attempt, CHECK_SCHEDULE.length)))
    const segments: [number, number | null][] = checks.map((c, i) => [c, checks[i + 1] ?? null])
    return { settled: false, end: null, segments }
  }
  const end =
    stat.state === 'ready' && stat.landedAt
      ? secondsAt(stat.landedAt, status.startedAt)
      : stat.state === 'ready'
        ? (CHECK_SCHEDULE[Math.max(0, Math.min(status.attempt, CHECK_SCHEDULE.length) - 1)] ?? 0)
        : LAST_CHECK
  const checks = CHECK_SCHEDULE.filter(c => c < end)
  const starts: number[] = checks.length ? checks : [0]
  return { settled: true, end, segments: starts.map((c, i): [number, number] => [c, starts[i + 1] ?? end]) }
}
