import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  resolve: { alias: { src: fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    coverage: { provider: 'v8', include: ['src/**/*.ts'] },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['test/**/*.tn.ts'],
          environment: 'node',
          env: { NODE_ENV: 'production' },
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          globalSetup: 'test/cross-origin-server.ts',
          include: ['test/**/*.tb.ts'],
          env: { NODE_ENV: 'production' },
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
          },
        },
      },
    ],
  },
})
