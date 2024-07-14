/// <reference types="vitest" />
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [dts()],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'duplex-message',
      formats: ['umd', 'es'],
      fileName: (format) => (format === 'umd' ? 'index.umd.js' : 'index.es.js'),
    },
  },
  test: {
    include: ['test/**/*.{tb,tn}.ts', 'test/**/*.{tb,tn}.tsx'],
    exclude: ['demo/**'],
    coverage: {
      provider: 'istanbul',
      exclude: ['demo/**', 'test/**', 'dist/**', '*.config.ts'],
    },
    alias: {
      src: '/src',
    },
    globals: true,
  },
})
