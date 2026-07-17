import { defineConfig } from "vitest/config";

// Root-level scripts under prisma/ (reset/wipe tooling) and e2e/integration/
// (globalSetup) are outside every workspace suite; this config is their only
// runner, chained into `pnpm test`.
export default defineConfig({
  test: {
    include: ["prisma/*.test.ts", "e2e/integration/*.test.ts"],
  },
});
