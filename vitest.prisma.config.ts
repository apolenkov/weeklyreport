import * as path from "node:path";

import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "./vitest.base.config.ts";

// Root-level code under prisma/ and the tester-kit crawler under scripts/ui-crawl
// are outside every workspace suite; this config is their only runner, chained
// into `pnpm test`.
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
      include: ["prisma/**/*.test.ts", "scripts/ui-crawl/**/*.test.ts"],
    },
  }),
);
