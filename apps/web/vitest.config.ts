import { createRequire } from 'module';
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const require = createRequire(
  path.resolve(__dirname, '../../packages/shared/package.json'),
);

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: false,
    exclude: ['e2e/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@customreport/shared': path.resolve(
        __dirname,
        '../../packages/shared/src',
      ),
      '@customreport/api': path.resolve(__dirname, '../../apps/api/src'),
      zod: path.dirname(require.resolve('zod/package.json')),
    },
  },
});
