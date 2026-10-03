import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'es2020',
    lib: {
      entry: 'src/index.ts',
      formats: ['cjs', 'es'],
      fileName: (format) => format === 'cjs' ? 'index.js' : 'index.es.mjs',
    },
    rolldownOptions: {
      external: ['electron', 'duplex-message'],
      output: {
        plugins: [{
          name: 'legacy-es-filename',
          generateBundle(_options, bundle) {
            if (bundle['index.js']) {
              this.emitFile({
                type: 'asset', fileName: 'index.node.mjs',
                source: "import api from './index.js'\nexport const { MainMessageHub, RendererMessageHub, setConfig, createRpcClient, waitForPeer, READY_METHOD, EErrorCode } = api\n",
              })
            }
            const chunk = bundle['index.es.mjs']
            if (chunk?.type === 'chunk') {
              this.emitFile({ type: 'asset', fileName: 'index.es.js', source: chunk.code })
            }
          },
        }],
      },
    },
  },
})
