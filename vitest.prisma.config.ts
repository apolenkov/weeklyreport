import * as path from "node:path";

import { defineConfig } from "vitest/config";

// Root-level code under prisma/ (reset/wipe tooling), e2e/ (globalSetup and the
// sweep's dev-login helper) and tools/ (the local ESLint plugin) is outside
// every workspace suite; this config is its only runner, chained into
// `pnpm test`.
export default defineConfig({
  // Nothing links the workspace packages into the repo root, so an import that
  // resolves inside apps/ does not resolve here. e2e/tsconfig.json carries the
  // same mapping for the typecheck; this is its runtime half.
  resolve: {
    alias: {
      "@customreport/shared": path.resolve(
        import.meta.dirname,
        "packages/shared/src/index.ts",
      ),
    },
  },
  test: {
    include: [
      "prisma/*.test.ts",
      "e2e/integration/*.test.ts",
      "e2e/sweep/helpers/*.test.ts",
      "tools/**/*.test.ts",
    ],
  },
});
