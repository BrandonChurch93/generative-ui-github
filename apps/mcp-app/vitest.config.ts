import { defineConfig } from 'vitest/config'

// The view's Vite config roots at view/; the unit tests live in src/ and run in Node.
export default defineConfig({ test: { include: ['src/**/*.test.ts'], environment: 'node' } })
