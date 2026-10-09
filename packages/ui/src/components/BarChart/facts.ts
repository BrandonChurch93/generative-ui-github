// Plain, so the composer can check a finding the way the chart does without loading React.

/**
 * The figures a sentence about the bars may cite: each value, how many bars, their total, the spread,
 * and each bar's share of the total ("23 of the 61", "38% of stale issues").
 */
export function barFacts(values: readonly number[]): number[] {
  if (!values.length) return [0]
  const total = values.reduce((a, b) => a + b, 0)
  const facts = [...values, values.length, total, Math.max(...values) - Math.min(...values)]
  if (total > 0) facts.push(...values.map(v => (v / total) * 100))
  return facts
}
