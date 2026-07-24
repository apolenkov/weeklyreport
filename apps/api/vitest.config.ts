import { defineConfig } from "vitest/config";

/**
 * Explicit vitest config so CI can run with --coverage and enforce
 * thresholds — pinning coverage floors here avoids command-line bloat in
 * the `test` script.
 *
 * Coverage thresholds calibrated to the existing suite (598 unit tests). If
 * a sweep fix drops coverage below the floor, CI fails and the dev fixes
 * the gap rather than silently regressing.
 */
export default defineConfig({
  test: {
    // Provide the product-critical env vars the app reads via requireEnv (the
    // schema has no defaults and vitest doesn't load .env). See the setup file.
    setupFiles: ["./src/test-utils/test-env.setup.ts"],
    // Mirrors the `test` script's exclude rule so unit + integration runs
    // diverge cleanly. Integration uses --fileParallelism=false on demand.
    exclude: [
      "**/*.integration.test.ts",
      "**/*.eval.test.ts",
      "**/dist/**",
      "**/node_modules/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
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
});
