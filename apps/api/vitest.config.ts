import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "../../vitest.base.config";

// Thresholds live here so CI needs no command-line bloat on the test script.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Provide the product-critical env vars the app reads via requireEnv (the
      // schema has no defaults and vitest doesn't load .env). See the setup file.
      setupFiles: ["./src/test-utils/test-env.setup.ts"],
      // Repository-wide TypeScript and ESLint gates allocate their own worker
      // processes. Keep enough CPU headroom that those gates measure code
      // defects instead of timing out behind the unit-test worker pool.
      maxWorkers: 4,
      // Integration suites have their own runner, so the default run stays
      // unit-only.
      exclude: ["**/*.integration.test.ts", "**/dist/**", "**/node_modules/**"],
      coverage: {
        include: ["src/**/*.ts", "src/**/*.tsx"],
        exclude: [
          "src/**/*.test.ts",
          "src/**/*.test.tsx",
          "src/**/*.integration.test.ts",
          "src/**/__tests__/**",
          "src/**/test-utils/**",
          "src/main.ts",
          "src/**/*.module.ts",
        ],
        thresholds: {
          statements: 80,
          branches: 70,
          functions: 80,
          lines: 80,
        },
      },
    },
  }),
);
