import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// The frame is one HTML file with everything inlined: hosts serve the resource's text as it is.
export default defineConfig({
  root: fileURLToPath(new URL('./view', import.meta.url)),
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: fileURLToPath(new URL('./dist/view', import.meta.url)),
    emptyOutDir: true,
  },
})
