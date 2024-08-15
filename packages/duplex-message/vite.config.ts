/// <reference types="vitest" />
import { defineConfig } from 'vite'

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
            broadcast: './demo/broadcast/index.html',
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
