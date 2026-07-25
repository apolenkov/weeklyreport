import { createRequire } from "node:module";
import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "../../vitest.base.config";

const require = createRequire(
  path.resolve(__dirname, "../../packages/shared/package.json"),
);

const webConfig = defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: false,
    // Restore every spy/mock to its original after each test so an installed
    // spy (e.g. a stderr silencer) never leaks into an unrelated test.
    restoreMocks: true,
    exclude: ["e2e/**", "node_modules/**"],
    // Coverage floors. Web has more UI code than tests can drive without a
    // full E2E layer, so the bar is lower than api.
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/__tests__/**",
        "src/**/types.ts",
        "src/app/**/layout.tsx",
        "src/app/**/page.tsx", // RSC pages exercised via E2E, not unit
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
        __dirname,
        "../../packages/shared/src",
      ),
      "@customreport/api": path.resolve(__dirname, "../../apps/api/src"),
      zod: path.dirname(require.resolve("zod/package.json")),
      // Replace the `server-only` guard with an empty stub so RSC helper
      // modules can be imported in jsdom tests without throwing.
      "server-only": path.resolve(
        __dirname,
        "src/test-utils/server-only-mock.ts",
      ),
    },
  },
});

export default mergeConfig(baseConfig, webConfig);
