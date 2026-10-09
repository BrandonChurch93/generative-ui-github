// ESLint covers JS and TS. This covers everything else under a src/ directory: CSS, JSON, Markdown, HTML.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SKIP = new Set(['node_modules', '.next', 'dist', '.turbo', '.git'])
const TEXT = new Set(['.css', '.json', '.md', '.html', '.txt', '.svg', '.yaml', '.yml'])
const EM_DASH = '\u2014'
const failures = []

function walk(dir, inSrc) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, inSrc || name === 'src')
    else if (inSrc && TEXT.has(extname(name))) {
      readFileSync(path, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (line.includes(EM_DASH)) failures.push(`${relative(root, path)}:${i + 1}`)
        })
    }
  }
}

for (const top of ['apps', 'packages']) walk(join(root, top), false)

if (failures.length) {
  console.error(`Em dash found in ${failures.length} place(s). Use an interpunct between facts or a period to end a sentence.`)
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}
