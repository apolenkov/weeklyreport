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
      // Integration and eval suites have their own runner
      // (`vitest.integration.config.ts`, run with --fileParallelism=false), so
      // the default run stays unit-only.
      exclude: [
        "**/*.integration.test.ts",
        "**/*.eval.test.ts",
        "**/dist/**",
        "**/node_modules/**",
      ],
      coverage: {
        include: ["src/**/*.ts"],
        exclude: [
          "src/**/*.test.ts",
          "src/**/*.integration.test.ts",
          "src/**/*.eval.test.ts",
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
