import { defineConfig } from 'tsup'

// The published build: core is a private workspace package, so it is bundled in; ui is a published peer of this one.
export default defineConfig({
  entry: { index: 'src/index.ts', core: 'src/core.ts' },
  format: ['esm'],
  // CSS modules keep their scoped class names; tsup's own CSS handling would turn each into an empty object.
  loader: { '.css': 'local-css' },
  target: 'es2022',
  platform: 'browser',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: { resolve: ['@genui-github/core'], compilerOptions: { composite: false, ignoreDeprecations: '6.0' } },
  external: ['react', 'react-dom', 'react/jsx-runtime', 'gsap', /^gsap\//, 'motion', /^motion\//, 'zod', /^@genui-github\/ui/],
  noExternal: [/^@genui-github\/core/],
})
