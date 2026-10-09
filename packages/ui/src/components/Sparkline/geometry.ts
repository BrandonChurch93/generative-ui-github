/** Points in a 0 to 100 box, oldest left. y grows downward, as SVG does. */
export interface SparkGeometry {
  line: string
  latest: string
  end: { x: number; y: number }
}

/**
 * Scales the series to its own range, never from zero, since the number beside it carries the size.
 * The span never falls under 25% of the latest value, so a steady series stays a calm band instead of noise.
 */
export function sparkGeometry(points: readonly number[]): SparkGeometry | null {
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const latest = points.at(-1)!
  const span = Math.max(max - min, Math.abs(latest) * 0.25)
  const lo = span === 0 ? min - 1 : min - (span - (max - min)) / 2
  const range = span === 0 ? 2 : span
  const xy = points.map((p, i) => ({ x: (i / (points.length - 1)) * 100, y: 100 - ((p - lo) / range) * 100 }))
  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  return { line: toPath(xy.slice(0, -1)), latest: toPath(xy.slice(-2)), end: xy.at(-1)! }
}
