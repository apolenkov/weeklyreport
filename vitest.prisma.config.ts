import * as path from "node:path";

import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "./vitest.base.config.ts";

// Root-level code under prisma/ is outside every workspace suite; this config
// is its only runner, chained into `pnpm test`.
export default mergeConfig(
  baseConfig,
  defineConfig({
    // Resolve @customreport/shared to the same source entry that
    // tsconfig.prisma.json maps for this suite.
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
  }),
);
