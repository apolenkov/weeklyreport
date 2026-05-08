import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

config({ path: '../../.env.test' });

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    exclude: ['**/*.eval.test.ts', '**/dist/**', '**/node_modules/**'],
  },
});
