import { defineConfig } from "vitest/config";

// Root-level code under prisma/ (reset/wipe tooling), e2e/integration/
// (globalSetup) and tools/ (the local ESLint plugin) is outside every workspace
// suite; this config is its only runner, chained into `pnpm test`.
export default defineConfig({
  test: {
    include: [
      "prisma/*.test.ts",
      "e2e/integration/*.test.ts",
      "tools/**/*.test.ts",
    ],
  },
});
