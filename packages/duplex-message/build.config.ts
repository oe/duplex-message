import { build, UserConfig } from 'vite'
import dts from 'vite-plugin-dts'

const defaultConfig: UserConfig = {
  plugins: [dts({
    rollupTypes: true,
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
}

const productionConfig: UserConfig = {
  build: {
    emptyOutDir: false,
    // @ts-ignore
    lib: {
      ...defaultConfig.build!.lib,
      fileName: (format) => (format === 'umd' ? 'index.production.umd.js' : 'index.production.es.js')
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  }
}

async function main() {
  await build(defaultConfig)
  await build(productionConfig)
}

main()
