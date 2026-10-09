// Component CSS takes every value from tokens.css: no hex colors, no pixel values.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else if (name.endsWith('.css')) check(path)
  }
}

function check(path) {
  const text = readFileSync(path, 'utf8')
  const original = text.split('\n')
  const lines = text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).split('\n')
  lines.forEach((line, i) => {
    // A raw value is allowed only where CSS cannot read a custom property, and the line above says so.
    if (i > 0 && original[i - 1].includes('raw-ok:')) return
    const hex = line.match(/#[0-9a-fA-F]{3,8}\b/)
    const px = line.match(/(?<![\w-])\d*\.?\d+px\b/)
    if (hex || px) failures.push(`${relative(root, path)}:${i + 1}  ${(hex ?? px)[0]}  ${line.trim()}`)
  })
}

walk(join(root, 'packages/ui/src'))
walk(join(root, 'packages/renderer/src'))
walk(join(root, 'apps/web/src'))
walk(join(root, 'apps/mcp-app/view'))

if (failures.length) {
  console.error(`Raw values in component CSS (${failures.length}). Use a token from tokens.css, or add one to tokens.json.`)
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}
