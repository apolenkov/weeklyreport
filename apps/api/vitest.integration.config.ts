import { config } from "dotenv";
import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "../../vitest.base.config.ts";

config({ path: "../../.env.test" });

// The env schema requires LOG_LEVEL (no fallback); `.env.test` need not carry
// it for integration runs.
process.env.LOG_LEVEL ??= "info";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ["src/**/*.integration.test.ts"],
      exclude: ["**/dist/**", "**/node_modules/**"],
    },
  }),
);
