import tseslint from 'typescript-eslint';
import pluginVitest from '@vitest/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import oxlint from 'eslint-plugin-oxlint';

export default defineConfig(
  globalIgnores(['**/dist/**', '**/coverage/**']),

  // TypeScript configurations with type-checking enabled
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Vitest configuration for test files
  {
    files: ['**/__tests__/**/*.test.*'],
    ...pluginVitest.configs.recommended,
  },

  // Oxlint should typically be passed via its build/config helper at the end
  ...oxlint.configs['flat/recommended'],
  {
    rules: {
      'oxlint/no-await-in-loop': 'off',
    },
  },
);