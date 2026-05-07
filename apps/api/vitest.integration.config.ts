import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    exclude: ['**/*.eval.test.ts', '**/dist/**', '**/node_modules/**'],
  },
});
