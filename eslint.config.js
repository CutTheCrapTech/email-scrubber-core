import globals from 'globals';
import tseslint from 'typescript-eslint';
import js from '@eslint/js';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

/**
 * @type {import('eslint').Linter.FlatConfig[]}
 */
export default [
  {
    // Global ignores
    ignores: [
      'dist/',
      'node_modules/',
      'coverage/',
      '**/*.log',
      '**/*.log.*',
    ],
  },

  // Base ESLint recommended config
  js.configs.recommended,

  // TypeScript recommended config
  ...tseslint.configs.recommended,

  {
    rules: {
      // Allow underscore-prefixed variables to be unused.
      // This is common for intentionally unused function arguments or catch block variables.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },

  // This must be the last element in the array.
  // It enables the Prettier plugin, which reports formatting issues as ESLint errors,
  // and it extends the Prettier config, which disables any ESLint rules that might conflict with Prettier.
  prettierRecommended,

  // Global language options
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
];
