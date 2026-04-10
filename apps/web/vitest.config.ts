import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      '@customreport/shared': path.resolve(
        __dirname,
        '../../packages/shared/src',
      ),
      '@customreport/api': path.resolve(__dirname, '../../apps/api/src'),
    },
  },
});
