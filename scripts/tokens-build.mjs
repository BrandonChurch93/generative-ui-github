import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'design-system/tokens.json')
const out = resolve(root, 'design-system/tokens.css')
const t = JSON.parse(readFileSync(src, 'utf8'))

const alias = v => (typeof v === 'string' ? v.replace(/^\{(.+)\}$/, 'var(--$1)') : v)
const themeValue = (v, theme) => (typeof v === 'string' ? v : v[theme] ?? v[t.color.themes[0].id])
const lines = []

lines.push(':root {')
for (const fam of ['color', 'spacing', 'radius', 'shadow', 'size']) {
  lines.push(`  /* ${fam} */`)
  for (const tok of t[fam].tokens) lines.push(`  --${tok.name}: ${alias(themeValue(tok.value, t.color.themes[0].id))};`)
}
lines.push('  /* type families */')
for (const [k, v] of Object.entries(t.type.families)) lines.push(`  --font-${k}: ${v};`)
lines.push('  /* type styles: size / leading / weight / tracking */')
for (const g of t.type.groups) for (const s of g.styles) {
  lines.push(`  --text-${s.name}-size: ${s.fontSize};`)
  lines.push(`  --text-${s.name}-leading: ${s.lineHeight};`)
  lines.push(`  --text-${s.name}-weight: ${s.fontWeight};`)
  if (s.letterSpacing) lines.push(`  --text-${s.name}-tracking: ${s.letterSpacing};`)
}
lines.push('}')

// further themes: a block per theme id after the first
for (const theme of t.color.themes.slice(1)) {
  const block = []
  for (const tok of t.color.tokens) block.push(`  --${tok.name}: ${alias(themeValue(tok.value, theme.id))};`)
  for (const tok of t.shadow?.tokens ?? []) block.push(`  --${tok.name}: ${alias(themeValue(tok.value, theme.id))};`)
  lines.push(`[data-theme="${theme.id}"] { color-scheme: ${theme.id};`, ...block, '}')
  if (theme.id === 'dark') lines.push(`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { color-scheme: dark;`, ...block, '} }')
}

// density: three blocks from the density family, comfortable on :root
const dens = t.density?.tokens ?? []
const byLevel = level => dens.filter(d => d.name.startsWith(level + '-')).map(d => `--${d.name.slice(level.length + 1)}: ${d.value};`)
lines.push(`:root { ${byLevel('comfortable').join(' ')} }`)
lines.push(`[data-density="compact"] { ${byLevel('compact').join(' ')} }`)
lines.push(`[data-density="spacious"] { ${byLevel('spacious').join(' ')} }`)
lines.push(`@media (max-width: 639px) { [data-density="spacious"] { ${byLevel('comfortable').join(' ')} } }`)

writeFileSync(out, lines.join('\n') + '\n')
console.log(`wrote ${out} (${lines.length} lines)`)
