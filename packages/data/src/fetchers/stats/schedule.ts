/** Seconds after the first request at which every counting statistic is checked again (docs/data-layer.md). */
export const CHECK_SCHEDULE = [0, 4, 10, 18, 28, 40, 54, 70, 90, 120] as const

export const CHECKS = CHECK_SCHEDULE.length

/** How many scheduled checks are due `elapsedMs` after the first request: at least 1, at most every check. */
export function checksDue(elapsedMs: number): number {
  return Math.max(1, CHECK_SCHEDULE.filter(s => s * 1000 <= elapsedMs).length)
}

/** Milliseconds from now until the check after `attempt`; 0 once the last check has run. */
export function msUntilNextCheck(attempt: number, elapsedMs: number): number {
  const next = CHECK_SCHEDULE[attempt]
  return next === undefined ? 0 : Math.max(0, next * 1000 - elapsedMs)
}
