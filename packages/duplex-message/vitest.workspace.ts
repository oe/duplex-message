// vitest.workspace.ts
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    test: {
      // an example of file based convention,
      // you don't have to follow it
      include: [
        'test/**/*.tn.ts',
      ],
      name: 'unit',
      alias: {
        src: '/src',
      },
      env: {
        NODE_ENV: 'production',
      },
      environment: 'node',
    },
  },
  {
    test: {
      // an example of file based convention,
      // you don't have to follow it
      include: [
        'test/**/*.tb.ts',
      ],
      alias: {
        src: '/src',
        test: '/test',
      },
      env: {
        NODE_ENV: 'development',
      },
      name: 'browser',
      browser: {
        provider: 'playwright',
        enabled: true,
        name: 'chromium',
        headless: true,
      },
    },
  },
])
