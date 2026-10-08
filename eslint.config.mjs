import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'src/main.js',
      'app.js',
      'data/foods.js',
      'dev/diagnostics/**'
    ]
  },
  js.configs.recommended,
  {
    files: ['src/features/**/*.js', 'src/state/**/*.js', 'src/api/**/*.js', 'src/ui/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser
      }
    },
    rules: {
      'no-var': 'error',
      'prefer-const': 'error',
      'no-undef': 'error',
      'no-empty': 'error',
      'no-unreachable': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-unused-vars': 'off'
    }
  }
];
