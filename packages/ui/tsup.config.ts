import { defineConfig } from 'tsup'

// The published build: core and data are private workspace packages, so they are bundled in, types and all.
export default defineConfig({
  entry: { index: 'src/index.ts', pieces: 'src/pieces.ts', motion: 'src/motion/index.ts', registry: 'src/specs.ts' },
  format: ['esm'],
  // CSS modules keep their scoped class names; tsup's own CSS handling would turn each into an empty object.
  loader: { '.css': 'local-css' },
  target: 'es2022',
  platform: 'browser',
  outDir: 'dist',
  clean: true,
  splitting: true,
  sourcemap: true,
  dts: { resolve: [/^@genui-github\/(core|data)/], compilerOptions: { composite: false, ignoreDeprecations: '6.0' } },
  external: ['react', 'react-dom', 'react/jsx-runtime', 'gsap', /^gsap\//, 'motion', /^motion\//, 'zod'],
  noExternal: [/^@genui-github\/(core|data)/],
})
