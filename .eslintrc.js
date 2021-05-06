module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  // extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  extends: ["airbnb-typescript"],
  parserOptions: {
    project: './tsconfig.json',
 }
};
