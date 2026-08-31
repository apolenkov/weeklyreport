import { config } from "dotenv";
import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "../../vitest.base.config.ts";

config({ path: "../../.env.test" });

// Services build their logger at field-init via `createServiceLogger`, which
// parses LOG_LEVEL through the env schema (no fallback); `.env.test` need not
// carry it for integration runs.
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
