import { defineConfig } from "vitest/config";

// Thresholds live here so CI needs no command-line bloat on the test script.
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
