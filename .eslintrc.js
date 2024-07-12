module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  // extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  extends: ['airbnb-typescript'],
  parserOptions: {
    project: './tsconfig.json',
  },
  rules: {
    'no-underscore-dangle': ['off'],
    'no-nested-ternary': ['off'],
    'no-console': ['off'],
    'import/no-extraneous-dependencies': ['error',
      {
        devDependencies: [
          '**/vite.config.ts',
          'jest.config.ts',
          '**/*.test.ts',
        ],
      },
    ],
    'import/prefer-default-export': ['off'],
    'prefer-promise-reject-errors': ['off'],
    '@typescript-eslint/no-throw-literal': ['off'],
    '@typescript-eslint/no-unused-expressions': ['off'],
    semi: 'off',
    '@typescript-eslint/semi': ['error', 'never'],
  },
}
