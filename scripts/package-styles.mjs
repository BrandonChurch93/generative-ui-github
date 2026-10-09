// One stylesheet for a published package: the tokens, the shared rules, then every component's module CSS.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [pkgDir, ...parts] = process.argv.slice(2)
const out = parts
  .map(p => resolve(pkgDir, p))
  .filter(p => existsSync(p))
  .map(p => readFileSync(p, 'utf8').replace(/\/\*# sourceMappingURL=.*?\*\/\s*$/m, ''))
  .join('\n')
writeFileSync(resolve(pkgDir, 'dist/styles.css'), out)
