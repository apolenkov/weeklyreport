import { createRequire } from "node:module";
import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "../../vitest.base.config.ts";

const require = createRequire(
  path.resolve(import.meta.dirname, "../../packages/shared/package.json"),
);

const webConfig = defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup"],
    // Node 25+ exposes process-wide Web Storage by default. jsdom supplies the
    // browser-scoped implementation these tests need, so keep the Node copy
    // disabled in workers instead of emitting a warning for every access.
    execArgv: ["--no-experimental-webstorage"],
    globals: false,
    // Reset every mock between tests (Vitest 4 restores the original vi.fn
    // implementation) so implementations and history never leak across tests.
    mockReset: true,
    restoreMocks: true,
    exclude: ["node_modules/**"],
    // Coverage floors. Web has more UI code than the focused DOM suite drives,
    // so the bar is lower than api.
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/__tests__/**",
        "src/**/types.ts",
        "src/app/**/layout.tsx",
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@customreport/shared": path.resolve(
        import.meta.dirname,
        "../../packages/shared/src",
      ),
      "@customreport/api": path.resolve(
        import.meta.dirname,
        "../../apps/api/src",
      ),
      zod: path.dirname(require.resolve("zod/package.json")),
      // Replace the `server-only` guard with an empty stub so RSC helper
      // modules can be imported in jsdom tests without throwing.
      "server-only": path.resolve(
        import.meta.dirname,
        "src/test-utils/server-only-mock.ts",
      ),
    },
  },
});

export default mergeConfig(baseConfig, webConfig);
