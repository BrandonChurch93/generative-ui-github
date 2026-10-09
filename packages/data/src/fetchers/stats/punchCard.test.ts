import { describe, expect, it } from 'vitest'
import { normalizePunchCard, punchCardInZone } from './punchCard'

// GitHub's rows: Sunday 23:00 UTC 5 commits, Monday 00:00 UTC 2, Saturday 23:00 UTC 1.
const raw = [
  [0, 23, 5],
  [1, 0, 2],
  [6, 23, 1],
]
const january = Date.parse('2026-01-15T12:00:00Z')

function busy(card: ReturnType<typeof normalizePunchCard>) {
  return card.cells.filter(c => c.commits > 0).map(c => [c.day, c.hour, c.commits])
}

describe('punch card', () => {
  it('reorders Monday first and shifts commits across day, hour and week boundaries', () => {
    const utc = normalizePunchCard(raw)
    expect(busy(utc)).toEqual([
      [0, 0, 2],
      [5, 23, 1],
      [6, 23, 5],
    ])
    // New York in January is UTC-5: Monday 00:00 UTC is Sunday 19:00.
    expect(busy(punchCardInZone(utc, 'America/New_York', january))).toEqual([
      [5, 18, 1],
      [6, 18, 5],
      [6, 19, 2],
    ])
    // Tokyo is UTC+9: Sunday 23:00 UTC wraps into Monday 08:00 of the same week grid.
    expect(busy(punchCardInZone(utc, 'Asia/Tokyo', january))).toEqual([
      [0, 8, 5],
      [0, 9, 2],
      [6, 8, 1],
    ])
    // Kolkata is UTC+5:30: the 23:00 UTC hour runs 04:30 to 05:30, so it goes to 05:00.
    expect(busy(punchCardInZone(utc, 'Asia/Kolkata', january))).toEqual([
      [0, 5, 5],
      [0, 6, 2],
      [6, 5, 1],
    ])
  })
})
