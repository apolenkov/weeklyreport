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
    // 34-02: coverage floors. Web has more UI code than tests can drive
    // without a full E2E layer, so the bar is lower than api. Threshold
    // raised over time as Phase 35 plans add component-level tests.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**',
        'src/**/types.ts',
        'src/app/**/layout.tsx',
        'src/app/**/page.tsx', // RSC pages exercised via E2E, not unit
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
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
