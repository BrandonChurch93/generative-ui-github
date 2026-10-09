import { defineConfig } from 'vitest/config'

// Node by default: binders and templates read fixtures from disk. A render test opts into jsdom with
// `// @vitest-environment jsdom` on its first line.
export default defineConfig({
  test: {
    environment: 'node',
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
