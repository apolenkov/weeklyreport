import * as path from "node:path";

import { defineConfig } from "vitest/config";

// Root-level code under prisma/, e2e/ and tools/ is outside every workspace
// suite; this config is its only runner, chained into `pnpm test`.
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
      "@playwright/test": path.resolve(
        import.meta.dirname,
        "apps/web/node_modules/@playwright/test/index.mjs",
      ),
      "@axe-core/playwright": path.resolve(
        import.meta.dirname,
        "apps/web/node_modules/@axe-core/playwright/dist/index.mjs",
      ),
    },
  },
  test: {
    // Runtime shard fixtures share deterministic repo-local roots. File-level
    // concurrency lets one fixture delete another and creates false timeouts.
    fileParallelism: false,
    include: [
      "prisma/**/*.test.ts",
      "e2e/acceptance/*.test.ts",
      "e2e/helpers/*.test.ts",
      "e2e/integration/*.test.ts",
      "e2e/runtime-api-server-command.test.ts",
      "e2e/runtime-sweep/**/*.test.ts",
      "e2e/sweep/*.test.ts",
      "e2e/sweep/helpers/*.test.ts",
      "e2e/csp/*.test.ts",
      "tools/**/*.test.ts",
    ],
  },
});
