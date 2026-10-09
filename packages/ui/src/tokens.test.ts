import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TOKEN_NAMES } from './tokens'

// Vitest runs from the package directory; import.meta.url is rewritten under jsdom.
const designSystem = (file: string) => readFileSync(resolve(process.cwd(), '../../design-system', file), 'utf8')
const css = designSystem('tokens.css')
const json = JSON.parse(designSystem('tokens.json')) as Record<string, { tokens?: { name: string }[]; groups?: { styles: { name: string }[] }[] }>

const declared = (name: string, block = ':root') => {
  const start = css.indexOf(`${block} {`)
  const end = css.indexOf('}', start)
  return start !== -1 && css.slice(start, end).includes(`--${name}:`)
}

describe('token additions from the build kit', () => {
  it.each(['radius-xs', 'scrim', 'sheet'])('%s is in tokens.json and tokens.css', name => {
    const inJson = Object.values(json).some(fam => fam.tokens?.some(t => t.name === name))
    expect(inJson).toBe(true)
    expect(declared(name)).toBe(true)
  })

  it.each(['handle', 'value', 'hint', 'section', 'lead'])('type style %s emits size, leading and weight', style => {
    const styles = json.type!.groups!.flatMap(g => g.styles.map(s => s.name))
    expect(styles).toContain(style)
    for (const part of ['size', 'leading', 'weight']) expect(declared(`text-${style}-${part}`)).toBe(true)
  })

  it.each(['compact', 'spacious'])('the density family emits a [data-density="%s"] block', level => {
    for (const v of ['inset', 'card-y', 'row-y', 'region-gap', 'metric-size', 'control-h', 'plot-h']) {
      expect(declared(v, `[data-density="${level}"]`)).toBe(true)
    }
  })

  it('comfortable is the default and spacious steps down under 640px', () => {
    expect(css).toMatch(/:root \{ --inset: 20px;.*--metric-size: 38px;/)
    expect(css).toMatch(/@media \(max-width: 639px\) \{ \[data-density="spacious"\] \{ --inset: 20px;.*--metric-size: 38px;/)
  })

  it('tokens.ts names every custom property in tokens.css', () => {
    const names = new Set([...css.matchAll(/--([a-z0-9-]+)\s*:/g)].map(m => m[1]))
    expect(new Set(TOKEN_NAMES)).toEqual(names)
  })
})
