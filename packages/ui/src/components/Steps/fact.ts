const INTEGER = /(?<![\w.,])(\d{1,3}(?:,\d{3})+|\d+)(?![\d.,]*\d)/

/** Splits a fact around its first whole number, so an update can count it. Versions and decimals are words, not counts. */
export function splitFact(fact: string): { before: string; value?: number; after: string } {
  const m = INTEGER.exec(fact)
  if (!m) return { before: fact, after: '' }
  return { before: fact.slice(0, m.index), value: Number(m[1]!.replace(/,/g, '')), after: fact.slice(m.index + m[0].length) }
}
