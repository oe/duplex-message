import typescript from "rollup-plugin-typescript2";
import pkg from "./package.json";

export default {
  input: "src/index.ts",
  output: {
    name: "WorkerServer",
    banner: `/*!
 * webworker-as-api v${pkg.version}
 * Copyright© ${new Date().getFullYear()} Saiya ${pkg.homepage}
 */`,
    format: process.env.format,
    file: `dist/webworker-as-api.${process.env.format}.js`
  },
  plugins: [
    typescript({
      tsconfigOverride: {
        compilerOptions: { module: "esnext" }
      },
      typescript: require("typescript")
    })
  ]
};
