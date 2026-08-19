import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

/**
 * ESLint 9 reads flat config only; the starter's `.eslintrc.json` is kept for
 * reference but this file is what runs. Rules mirror it.
 */
export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.next/**',
      // Next regenerates this with a triple-slash routes reference.
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
      globals: { console: 'readonly', process: 'readonly', fetch: 'readonly' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-undef': 'off',
    },
  },
  prettier,
];
