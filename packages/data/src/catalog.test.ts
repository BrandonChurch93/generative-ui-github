import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { countsIn, formatValue, MEASURE_IDS, MEASURES, UNITS, type Unit, type UnitValue } from './measures'
import { SHAPE_NAMES } from './shapes'

const doc = (file: string) => readFileSync(resolve(process.cwd(), '../../docs', file), 'utf8')

/** Backticked names in the first cell of every table row in a section. */
function firstCellNames(markdown: string, heading: string): string[] {
  const start = markdown.indexOf(heading)
  const end = markdown.indexOf('\n## ', start + heading.length)
  const section = markdown.slice(start, end === -1 ? undefined : end)
  return section
    .split('\n')
    .filter(line => line.startsWith('| `'))
    .flatMap(line => [...line.split('|')[1]!.matchAll(/`([^`]+)`/g)].map(m => m[1]!))
}

describe('measure catalog', () => {
  it('lists every measure id in docs/schemas.md, and only those', () => {
    const documented = firstCellNames(doc('schemas.md'), '## Measure catalog')
    expect(documented.length).toBe(30)
    expect([...MEASURE_IDS].sort()).toEqual([...documented].sort())
  })

  it('gives every measure a sentence-case label that fits a Metric', () => {
    for (const id of MEASURE_IDS) {
      const { label } = MEASURES[id]
      expect(label.length, id).toBeLessThanOrEqual(28)
      expect(label[0], id).toBe(label[0]!.toUpperCase())
      const laterWords = label.split(' ').slice(1)
      expect(laterWords.filter(w => /^[A-Z][a-z]/.test(w)), id).toEqual([])
    }
  })

  const samples: { [U in Unit]: [UnitValue[U], string] } = {
    count: [1234, '1,234'],
    'count-of-total': [{ count: 2, total: 31 }, '2 of 31'],
    h: [19.64, '19.6 h'],
    d: [3, '3 d'],
    ratio: [0.82, '0.8 ×'],
    min: [18.43, '18.4 min'],
    percent: [12.5, '12.5 %'],
    runs: [4, '4 runs'],
    clock: [14, '14:00'],
    text: ['Sunday', 'Sunday'],
  }

  it.each(UNITS)('formats a %s value', unit => {
    const [value, expected] = samples[unit]
    const { text, suffix } = formatValue(unit, value as never)
    expect([text, suffix].filter(Boolean).join(' ')).toBe(expected)
  })

  it('formats a clock date and lets clock and text measures wipe instead of count', () => {
    expect(formatValue('clock', '2026-10-14T00:00:00Z').text).toBe('Oct 14')
    expect(countsIn('busiest-hour')).toBe(false)
    expect(countsIn('quietest-day')).toBe(false)
    expect(countsIn('failing-checks')).toBe(true)
  })
})

describe('shapes', () => {
  it('has a type for every shape named in docs/data-layer.md', () => {
    const md = doc('data-layer.md')
    const named = [...firstCellNames(md, '## Endpoints'), ...firstCellNames(md, '## Derived shapes the templates need')]
    expect(named.length).toBeGreaterThan(25)
    for (const name of named) expect(SHAPE_NAMES, name).toContain(name)
  })
})
