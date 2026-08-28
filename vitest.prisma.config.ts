import * as path from "node:path";

import { defineConfig } from "vitest/config";

// Root-level code under prisma/ and tools/ is outside every workspace
// suite; this config is its only runner, chained into `pnpm test`.
export default defineConfig({
  // Nothing links the workspace packages into the repo root, so an import that
  // resolves inside apps/ does not resolve here.
  resolve: {
    alias: {
      "@customreport/shared": path.resolve(
        import.meta.dirname,
        "packages/shared/src/index.ts",
      ),
    },
  },
  test: {
    include: ["prisma/**/*.test.ts", "tools/**/*.test.ts"],
  },
});
