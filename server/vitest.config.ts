import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC emits decorator metadata (esbuild does not), which Nest's constructor injection needs.
  plugins: [swc.vite({ module: { type: 'es6' } }), tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
  },
});
