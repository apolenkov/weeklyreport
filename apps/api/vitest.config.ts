import { defineConfig } from "vitest/config";

/**
 * 34-02: explicit vitest config so CI can run with --coverage and enforce
 * thresholds. Default config used to live implicitly via the `test` script;
 * extracting it here lets us pin coverage floors without command-line bloat.
 *
 * Coverage thresholds calibrated to the existing suite (598 unit tests). If
 * a sweep fix drops coverage below the floor, CI fails and the dev fixes
 * the gap rather than silently regressing.
 */
export default defineConfig({
  test: {
    // Mirrors the `test` script's exclude rule so unit + integration runs
    // diverge cleanly. Integration uses --fileParallelism=false on demand.
    exclude: [
      "**/*.integration.test.ts",
      "**/*.eval.test.ts",
      "**/dist/**",
      "**/node_modules/**",
      // TODO(fix-xml-crypto-xmldom-onerror): samlify-level errorHandler/mimeType
      // patched (patches/samlify@2.13.1.patch), but xml-crypto@6.1.2 still
      // calls parseFromString without mimeType in 11 places. Patching xml-crypto
      // touches the production @node-saml path — needs a separate change with
      // full SAML regression coverage. Skip until then.
      "**/saml.samlify.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.integration.test.ts",
        "src/**/*.eval.test.ts",
        "src/**/__tests__/**",
        "src/**/test-utils/**",
        "src/main.ts",
        "src/**/*.module.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
});
