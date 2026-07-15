import { defineConfig } from "vitest/config";

// Root-level scripts under prisma/ (reset/wipe tooling) are outside every
// workspace suite; this config is their only runner, chained into `pnpm test`.
export default defineConfig({
  test: {
    include: ["prisma/*.test.ts"],
  },
});
