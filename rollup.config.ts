import typescript from 'rollup-plugin-typescript2'
import resolve from 'rollup-plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'
import { sizeSnapshot } from 'rollup-plugin-size-snapshot'
const pkg = require('./package.json')
const { increaseVersion } = require('./build/update-pkg-version.js')
const newVer = increaseVersion(pkg.version)

export default [
  {
    input: 'src/index.ts',
    output: {
      name: 'MessageHub',
      banner: `/*!
 * ${pkg.name} v${newVer}
 * Copyright© ${new Date().getFullYear()} Saiya ${pkg.homepage}
 */`,
      format: 'es',
      file: `dist/message-hub.es.js`
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
      name: 'MessageHub',
      banner: `/*!
 * ${pkg.name} v${newVer}
 * Copyright© ${new Date().getFullYear()} Saiya ${pkg.homepage}
 */`,
      format: 'umd',
      file: `dist/message-hub.umd.js`
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
      name: 'MessageHub',
      banner: `/*!
 * ${pkg.name} v${newVer}
 * Copyright© ${new Date().getFullYear()} Saiya ${pkg.homepage}
 */`,
      format: 'umd',
      file: `dist/message-hub.browser.js`
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
              // multiline comment
              return /^!/i.test(text)
            }
          }
        }
      })
    ]
  }
]
