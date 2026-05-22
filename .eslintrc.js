/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    '@typescript-eslint/no-explicit-any': 'error',
  },
  overrides: [
    {
      // RÈGLE D'OR (CLAUDE.md §4) : domain/ ne peut jamais importer delivery/, adapters/ ou persistence/.
      // Toute violation est un bug architectural — la CI la bloquera.
      files: ['apps/*/src/domain/**/*.ts'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            {
              group: ['**/delivery', '**/delivery/**'],
              message: 'Architecture violation (CLAUDE.md §4) : domain/ ne peut pas importer delivery/.',
            },
            {
              group: ['**/adapters', '**/adapters/**'],
              message: 'Architecture violation (CLAUDE.md §4) : domain/ ne peut pas importer adapters/.',
            },
            {
              group: ['**/persistence', '**/persistence/**'],
              message: 'Architecture violation (CLAUDE.md §4) : domain/ ne peut pas importer persistence/.',
            },
          ],
        }],
      },
    },
    {
      files: ['apps/web/src/**/*.tsx'],
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  ],
  env: {
    node: true,
    es2022: true,
  },
};
