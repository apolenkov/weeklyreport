import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: "../../.env.test" });

// Services build their logger at field-init via `createServiceLogger`, which
// parses LOG_LEVEL through the env schema (no fallback); `.env.test` need not
// carry it for integration runs.
process.env.LOG_LEVEL ??= "info";

export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    exclude: ["**/*.eval.test.ts", "**/dist/**", "**/node_modules/**"],
  },
});
