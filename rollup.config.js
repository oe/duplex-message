import typescript from "rollup-plugin-typescript2";
import resolve from "rollup-plugin-node-resolve";
import { terser } from "rollup-plugin-terser";
import { sizeSnapshot } from "rollup-plugin-size-snapshot";
import pkg from "./package.json";

export default [
  {
    input: "src/index.ts",
    output: {
      name: "Postmsg",
      banner: `/*!
 * Postmsg v${pkg.version}
 * Copyright© ${new Date().getFullYear()} Saiya ${pkg.homepage}
 */`,
      format: "es",
      file: `dist/postmsg.es.js`
    },
    plugins: [
      typescript({
        tsconfigOverride: {
          compilerOptions: { module: "esnext" }
        },
        typescript: require("typescript")
      }),
      sizeSnapshot()
    ],
    external: ["composie"]
  },
  {
    input: "src/index.ts",
    output: {
      name: "WorkerServer",
      banner: `/*!
 * postmsg v${pkg.version}
 * Copyright© ${new Date().getFullYear()} Saiya ${pkg.homepage}
 */`,
      format: "umd",
      globals: {
        composie: "Composie"
      },
      file: `dist/postmsg.umd.js`
    },
    plugins: [
      typescript({
        tsconfigOverride: {
          compilerOptions: { module: "esnext" }
        },
        typescript: require("typescript")
      }),
      sizeSnapshot()
    ],
    external: ["composie"]
  },
  {
    input: "src/index.ts",
    output: {
      name: "WorkerServer",
      banner: `/*!
 * postmsg v${pkg.version}
 * Copyright© ${new Date().getFullYear()} Saiya ${pkg.homepage}
 */`,
      format: "umd",
      file: `dist/postmsg.browser.js`
    },
    plugins: [
      typescript({
        tsconfigOverride: {
          compilerOptions: { module: "esnext" }
        },
        typescript: require("typescript")
      }),
      resolve({
        browser: true
      }),
      sizeSnapshot(),
      terser({
        output: {
          comments: function(node, comment) {
            var text = comment.value;
            var type = comment.type;
            if (type == "comment2") {
              // multiline comment
              return /^!/i.test(text);
            }
          }
        }
      })
    ]
  }
];
