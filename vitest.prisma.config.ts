import * as path from "node:path";

import { defineConfig } from "vitest/config";

// Root-level code under prisma/ is outside every workspace suite; this config
// is its only runner, chained into `pnpm test`.
export default defineConfig({
  // Nothing links workspace packages into the repo root, so shared imports need
  // an explicit source alias here.
  resolve: {
    alias: {
      "@customreport/shared": path.resolve(
        import.meta.dirname,
        "packages/shared/src/index.ts",
      ),
    },
  },
  test: {
    include: ["prisma/**/*.test.ts"],
  },
});
