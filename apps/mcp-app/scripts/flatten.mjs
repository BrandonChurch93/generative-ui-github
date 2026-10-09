// Vite writes dist/view/index.html; the server reads dist/view.html. One file, everything inlined.
import { renameSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
renameSync(`${dist}view/index.html`, `${dist}view.html`)
rmSync(`${dist}view`, { recursive: true, force: true })
