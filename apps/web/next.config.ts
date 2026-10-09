import { fileURLToPath } from 'node:url'
import { loadEnvConfig } from '@next/env'
import type { NextConfig } from 'next'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

// .env.local lives at the repo root, but Next only reads env files beside the app. Variables already set win.
loadEnvConfig(repoRoot, process.env.NODE_ENV !== 'production', undefined, true)

const config: NextConfig = {
  transpilePackages: ['@genui-github/core'],
  outputFileTracingRoot: repoRoot,
  turbopack: { root: repoRoot },
}

export default config
