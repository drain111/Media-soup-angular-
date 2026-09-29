import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import pluginPlaywright from 'eslint-plugin-playwright';
import pluginVitest from '@vitest/eslint-plugin';
import oxlint from 'eslint-plugin-oxlint';
import skipFormatting from 'eslint-config-prettier/flat';

export default defineConfig(
  // Global Ignores
  globalIgnores(['**/dist/**', '**/coverage/**', '**/.angular/**']),

  // 1. Angular & TypeScript rules for .ts files
  {
    files: ['**/*.ts'],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
    },
  },

  // 2. Angular Template rules for HTML files
  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
  },

  // 3. Playwright E2E Tests
  {
    files: ['e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    ...pluginPlaywright.configs['flat/recommended'],
  },

  // 4. Vitest Unit Tests
  {
    files: ['src/**/__tests__/**/*', '**/*.spec.ts'],
    ...pluginVitest.configs.recommended,
  },

  // 5. Oxlint (turns off rules that Oxlint already checks fast)
  ...oxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  // 6. Prettier integration (must always come last)
  skipFormatting,
);