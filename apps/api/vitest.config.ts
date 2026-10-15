import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "../../vitest.base.config.ts";

// Thresholds live here so CI needs no command-line bloat on the test script.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Provide the product-critical env vars the app reads via requireEnv (the
      // schema has no defaults and vitest doesn't load .env). See the setup file.
      setupFiles: ["./src/test-utils/test-env.setup.ts"],
      // A unit test that builds a real Redis client must fail on DNS, not reach
      // a developer's Redis or the integration DB 15 (C2139); `.invalid` never resolves.
      env: { REDIS_HOST: "redis.invalid" },
      // Repository-wide TypeScript and ESLint gates allocate their own worker
      // processes. Keep enough CPU headroom that those gates measure code
      // defects instead of timing out behind the unit-test worker pool.
      maxWorkers: 2,
      // Integration suites have their own runner, so the default run stays
      // unit-only.
      exclude: ["**/*.integration.test.ts", "**/dist/**", "**/node_modules/**"],
      coverage: {
        include: ["src/**/*.ts"],
        exclude: [
          "src/**/*.test.ts",
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
