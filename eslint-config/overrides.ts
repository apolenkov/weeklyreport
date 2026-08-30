/// <reference path="../tools/types/eslint-plugin-jsx-a11y.d.ts" />

import vitest from "@vitest/eslint-plugin";
import type { Linter } from "eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";

const unrestrictedTestContourRules: Linter.RulesRecord = {
  "max-lines": "off",
  "max-lines-per-function": "off",
  complexity: "off",
  "sonarjs/cognitive-complexity": "off",
  "sonarjs/no-nested-functions": "off",
  "@typescript-eslint/no-magic-numbers": "off",
  "react-compiler/react-compiler": "off",
};

export const overrideConfig: Linter.Config[] = [
  {
    files: ["**/*.config.ts", "eslint-config/*.ts"],
    rules: {
      "max-lines": "off",
      complexity: "off",
      // Config knobs (ports, thresholds, rule options) ARE the named values —
      // lifting them to consts above adds indirection, not clarity. Same for
      // repeated path/glob literals in override lists.
      "@typescript-eslint/no-magic-numbers": "off",
      "sonarjs/no-duplicate-string": "off",
    },
  },
  // Tests keep type-aware safety and correctness checks, but product-only
  // structure/style budgets must not steer test design or product delivery.
  {
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/__tests__/**",
    ],
    plugins: { vitest },
    rules: {
      // `expect(mock.method)` is the whole point of a spy assertion, but the
      // base rule cannot tell it from a genuine `this`-losing method capture,
      // so it demanded a disable at 133 sites — 123 of them that one shape.
      // The vitest rule understands `expect` calls and flags everything else,
      // so this is a stricter check than the 133 blanket suppressions were.
      "@typescript-eslint/unbound-method": "off",
      "vitest/unbound-method": "error",
      // Keep only failure-prevention rules; preference/style rules belong to
      // production code quality, not the test contour.
      "vitest/no-done-callback": "error",
      "vitest/no-duplicate-hooks": "error",
      // `.only` fails the run under CI but only reports a skip locally, so this
      // moves the failure to the editor.
      "vitest/no-focused-tests": "error",
      "vitest/no-identical-title": "error",
      "vitest/no-interpolation-in-snapshots": "error",
      "vitest/no-mocks-import": "error",
      // An expect outside a test body runs at collection time, so a failure
      // takes the whole file down with no test attributed to it.
      "vitest/no-standalone-expect": "error",
      "vitest/require-awaited-expect-poll": "error",
      "vitest/require-local-test-context-for-concurrent-snapshots": "error",
      "vitest/valid-describe-callback": "error",
      "vitest/valid-expect-in-promise": "error",
      ...Object.fromEntries(
        Object.keys(jsxA11y.configs.recommended.rules).map((rule) => [
          rule,
          "off",
        ]),
      ),
      // Tests have no size, function-length or complexity budgets. Their
      // quality is behavioral: useful assertions, deterministic isolation and
      // correctness-specific lint, not production structure metrics.
      ...unrestrictedTestContourRules,
      // Test literals (fixture counts, expected values, dates) are the
      // assertion itself — naming each one adds noise, not meaning.
      "@typescript-eslint/no-magic-numbers": "off",
      // test fixtures legitimately embed fake IPs and
      // fake secrets (10.0.0.x audit-log samples, dummy PDF-export passwords).
      // The rules stay `error` in src; tests are exempt by design.
      "sonarjs/no-hardcoded-ip": "off",
      "sonarjs/hardcoded-secret-signatures": "off",
      // firings inherent to test code (the rules stay `error`
      // in src). http:// fixtures for local collectors/IP URLs; intentional
      // undefined args for legacy-contract checks; idiomatic duplicate render
      // wrappers; bare .sort() in test assertions.
      "sonarjs/no-clear-text-protocols": "off",
      "sonarjs/no-undefined-argument": "off",
      "sonarjs/no-identical-functions": "off",
      "sonarjs/no-alphabetical-sort": "off",
      // Repeated fixture strings are the test's vocabulary — lifting them to
      // consts obscures what each assertion literally checks.
      "sonarjs/no-duplicate-string": "off",
    },
  },
  // Non-test-named support code is part of the same unrestricted contour.
  {
    files: [
      "apps/*/src/test-utils/**",
      "**/__fixtures__/**",
      "**/fixture/**",
      "**/fixtures/**",
      "**/*-harness.{ts,tsx,js,jsx,mjs,cjs}",
      "**/*.fixture.{ts,tsx,js,jsx,mjs,cjs}",
      "**/*.fixtures.{ts,tsx,js,jsx,mjs,cjs}",
      "**/*-fixture.{ts,tsx,js,jsx,mjs,cjs}",
      "**/*-test-fixture.{ts,tsx,js,jsx,mjs,cjs}",
    ],
    rules: unrestrictedTestContourRules,
  },
];
