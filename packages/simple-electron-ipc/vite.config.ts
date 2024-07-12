import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [dts()],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'SimpleElectronIpc',
      formats: ['umd', 'es'],
      fileName: (format) => (format === 'umd' ? 'index.js' : 'index.es.js'),
    },
    rollupOptions: {
      external: ['electron'],
      output: {
        globals: {
          electron: 'electron',
        },
      },
    },
  },
})
