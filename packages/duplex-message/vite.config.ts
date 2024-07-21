/// <reference types="vitest" />
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig(({ mode }) => {
  if (mode === 'development') {
    return {
      build: {
        target: 'es2015',
        rollupOptions: {
          input: {
            worker: './demo/worker/index.html',
            frame: './demo/frame/index.html',
            page: './demo/page/index.html',
            storage: './demo/storage/index.html',
          },
        },
      },
      server: {
        open: '/demo/index.html'
      },
      alias: {
        src: '/src',
      },
    }
  }
  return {
    plugins: [dts({
      exclude: ['test/**', 'demo/**'],
    })],
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
  }
})
