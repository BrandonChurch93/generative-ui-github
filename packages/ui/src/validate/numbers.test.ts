import { describe, expect, it } from 'vitest'
import { extractNumbers, seriesFacts, validateNumbers } from './numbers'

describe('extractNumbers', () => {
  it('finds figures, separators, decimals, percents, references and spelled numbers', () => {
    const found = extractNumbers('Three PRs wait on #84120; 1,234 runs, 19.6 hours, 38% slower and 2 checks.')
    expect(found.map(n => [n.raw, n.value])).toEqual([
      ['Three', 3],
      ['#84120', 84120],
      ['1,234', 1234],
      ['19.6', 19.6],
      ['38%', 38],
      ['2', 2],
    ])
  })

  it('skips identifiers in backticks, versions and percentile names', () => {
    const found = extractNumbers('`e2e-turbopack` on v16.2 and 15.5.0 is red at p90 for 4 days.')
    expect(found.map(n => n.raw)).toEqual(['4'])
  })

  it('reads "one" as an article, not a figure', () => {
    expect(extractNumbers('One reviewer carries the milestone.')).toEqual([])
  })
})

describe('validateNumbers', () => {
  it('passes when every number appears in the data within the precision written', () => {
    const check = validateNumbers('v16.2 is held by three pull requests and 2 failing checks; review wait is 19.6h.', [3, 2, 19.64])
    expect(check.ok).toBe(true)
    expect(check.checked).toHaveLength(3)
  })

  it('matches a percent against a share', () => {
    expect(validateNumbers('Failing runs are at 12.5%.', [0.125]).ok).toBe(true)
  })

  it('never reads a ratio in × as a percent: the closure ratio says 0.6× wherever it appears', () => {
    // Closed per opened over twelve weeks, the weekly points as the chart and the sparkline draw them, and their facts.
    const weeks = [0.5, 1.1, 0.9, 1.2, 0, 0.3, 0.7, 0.4, 0.5, 0.3, 0, 0]
    const facts = [0.5687, ...seriesFacts(weeks)]
    expect(validateNumbers('Closure ratio fell from 0.5× to 0× over 12 weeks, 0.6× overall.', facts, { ratio: true }).ok).toBe(true)
    const percent = validateNumbers('Closure ratio fell from 50% to 0% over 12 weeks.', facts, { ratio: true })
    expect(percent.mismatches.map(n => n.raw)).toEqual(['50%'])
    expect(validateNumbers('Closure ratio is 57%.', facts, { ratio: true }).ok).toBe(false)
    expect(validateNumbers('Closure ratio fell 100% in 12 weeks.', facts, { ratio: true }).ok).toBe(true)
  })

  it('rejects a figure the data does not contain', () => {
    const check = validateNumbers('CI got 39% slower: the median went from 13.2 to 18.4 minutes.', [13.2, 18.4])
    expect(check.ok).toBe(false)
    expect(check.mismatches.map(n => n.raw)).toEqual(['39%'])
  })

  it('does not round a figure the model invented into a match', () => {
    expect(validateNumbers('Review wait is about 20 hours.', [19.4]).ok).toBe(false)
    expect(validateNumbers('Review wait is about 20 hours.', [19.6]).ok).toBe(true)
  })

  it('a sentence with no numbers passes', () => {
    expect(validateNumbers('Nothing stands out on v16.2 this week.', []).ok).toBe(true)
  })
})

describe('seriesFacts', () => {
  it('lets a chart finding cite the weeks and the change from first to last', async () => {
    const { seriesFacts } = await import('./numbers')
    const facts = seriesFacts([13.2, 13.6, 14.1, 18.4])
    expect(validateNumbers('CI got 39% slower in 4 weeks: the median went from 13.2 to 18.4 minutes.', facts).ok).toBe(true)
    expect(validateNumbers('CI got 45% slower.', facts).ok).toBe(false)
  })
})
