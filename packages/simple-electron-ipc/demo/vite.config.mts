import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('.', import.meta.url))
export default defineConfig(({ mode }) => {
  const preload = mode === 'preload'
  return {
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      target: 'es2020',
      outDir: join(root, 'dist'),
      emptyOutDir: false,
      lib: {
        entry: join(root, preload ? 'preload.ts' : 'render.ts'),
        name: 'DuplexDemo',
        formats: preload ? ['cjs'] : ['iife'],
        fileName: () => preload ? 'preload.cjs' : 'render.js',
      },
      rolldownOptions: { external: preload ? ['electron'] : [] },
    },
  }
})
