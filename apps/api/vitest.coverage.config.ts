import { config } from "dotenv";
import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "../../vitest.base.config";

// Match the dedicated integration runner locally while preserving explicit CI
// environment values (`dotenv` does not override variables by default).
config({ path: "../../.env.test" });

// Coverage is a release-evidence contour, not the fast unit contour. It runs
// unit and database integration suites in one serial process so repository
// adapters count only when their real PostgreSQL/Redis/SMTP paths execute.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      setupFiles: ["./src/test-utils/test-env.setup.ts"],
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      exclude: ["**/dist/**", "**/node_modules/**"],
      fileParallelism: false,
      maxWorkers: 1,
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
