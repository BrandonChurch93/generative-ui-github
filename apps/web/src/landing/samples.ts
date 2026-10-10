/** A sample repo as its landing card shows it: the docs' name, and the description and stars its sample file holds. */
export interface SampleRepo {
  name: string
  avatar: string
  description?: string
  stars?: number
}

/** "143k", "97.8k", "812": a star count as GitHub abbreviates it. */
export function starCount(n: number): string {
  if (n < 1000) return n.toLocaleString('en-US')
  const k = Math.round(n / 100) / 10
  return `${k >= 100 ? Math.round(k) : k}k`
}

/** The owner's face as GitHub serves it, at twice the card's size for dense screens. */
export const avatarUrl = (owner: string) => `https://github.com/${encodeURIComponent(owner)}.png?size=64`
