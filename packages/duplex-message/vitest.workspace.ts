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
