import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import { genuiPlugin } from './packages/core/lint/index.js'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/next-env.d.ts',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/.lighthouseci/**',
      'design-system/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.tsx'],
    ...reactHooks.configs.flat['recommended-latest'],
  },
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    plugins: { genui: genuiPlugin },
    rules: {
      'genui/no-em-dash': 'error',
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // CLI scripts report to the terminal; that output is their interface.
    files: ['scripts/**'],
    rules: { 'no-console': 'off' },
  },
)
