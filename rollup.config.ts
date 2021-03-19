import typescript from 'rollup-plugin-typescript2'
import resolve from 'rollup-plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'
import { sizeSnapshot } from 'rollup-plugin-size-snapshot'
const pkg = require('./package.json')

export default [
  {
    input: 'src/index.ts',
    output: {
      name: 'DuplexMessage',
      banner: `/*!
 * ${pkg.name}
 * Copyright© ${new Date().getFullYear()} Saiya ${pkg.homepage}
 */`,
      format: 'es',
      file: `dist/duplex-message.es.js`
    },
    plugins: [
      typescript({
        tsconfigOverride: {
          compilerOptions: { module: 'esnext', target: 'es2017' }
        },
        typescript: require('typescript')
      }),
      sizeSnapshot()
    ],
  },
  {
    input: 'src/index.ts',
    output: {
      name: 'DuplexMessage',
      banner: `/*!
 * ${pkg.name}
 * Copyright© ${new Date().getFullYear()} Saiya ${pkg.homepage}
 */`,
      format: 'umd',
      file: `dist/duplex-message.umd.js`
    },
    plugins: [
      typescript({
        tsconfigOverride: {
          compilerOptions: { module: 'esnext', target: 'es6' }
        },
        typescript: require('typescript')
      }),
      sizeSnapshot()
    ],
  },
  {
    input: 'src/index.ts',
    output: {
      name: 'DuplexMessage',
      banner: `/*!
 * ${pkg.name}
 * Copyright© ${new Date().getFullYear()} Saiya ${pkg.homepage}
 */`,
      format: 'umd',
      file: `dist/duplex-message.browser.js`
    },
    plugins: [
      typescript({
        tsconfigOverride: {
          compilerOptions: { module: 'esnext', target: 'es5' }
        },
        typescript: require('typescript')
      }),
      resolve({
        browser: true
      }),
      sizeSnapshot(),
      terser({
        output: {
          comments: function (node, comment) {
            const text = comment.value
            const type = comment.type
            if (type === 'comment2') {
              // multiline comment, remove typescript block comments, really too long
              return /^\!\s+[^*]/i.test(text)
            }
          }
        }
      })
    ]
  }
]
