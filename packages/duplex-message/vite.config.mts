import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  define: mode === 'production-lib' ? { 'process.env.NODE_ENV': '"production"' } : {},
  resolve: { alias: { src: fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { open: '/demo/index.html' },
  build: mode === 'demo' ? {
    outDir: 'demo/dist',
    rolldownOptions: {
      input: {
        index: 'demo/index.html',
        ...Object.fromEntries(['worker', 'frame', 'page', 'storage', 'broadcast']
          .map((name) => [name, `demo/${name}/index.html`])),
        childFrame: 'demo/frame/frame.html',
        nestedFrame: 'demo/frame/sub-frame.html',
      },
    },
  } : {
    target: 'es2020',
    emptyOutDir: mode !== 'production-lib',
    lib: {
      entry: 'src/index.ts',
      name: 'duplex-message',
      formats: mode === 'production-lib' ? ['es', 'umd'] : ['es', 'cjs', 'umd'],
      fileName: (format) => mode === 'production-lib'
        ? format === 'es' ? 'index.production.es.mjs' : 'index.production.umd.js'
        : format === 'es' ? 'index.es.mjs' : format === 'cjs' ? 'index.cjs' : 'index.umd.js',
    },
    rolldownOptions: {
      output: {
        // Retain the existing distribution URLs for browser/script consumers.
        plugins: [{
          name: 'legacy-filenames',
          generateBundle(_options, bundle) {
            for (const chunk of Object.values(bundle)) {
              if (chunk.type !== 'chunk') continue
              const names = chunk.fileName === 'index.es.mjs'
                ? ['index.es.js'] : chunk.fileName === 'index.production.es.mjs'
                  ? ['index.production.es.js'] : []
              for (const fileName of names) this.emitFile({ type: 'asset', fileName, source: chunk.code })
            }
          },
        }],
      },
    },
  },
}))
