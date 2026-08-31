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
    globals: false,
    // Restore every spy/mock to its original after each test so an installed
    // spy (e.g. a stderr silencer) never leaks into an unrelated test.
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
