import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "../../vitest.base.config.ts";

// Mutation workers run only the pure period-transition unit suite: no
// PostgreSQL, Redis, Mailpit or browser, so mutants stay fast and isolated.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      setupFiles: ["./src/test-utils/test-env.setup.ts"],
      include: ["src/modules/period/domain/period-transition.test.ts"],
    },
  }),
);
