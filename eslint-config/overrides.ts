/// <reference path="../tools/types/eslint-plugin-jsx-a11y.d.ts" />

import vitest from "@vitest/eslint-plugin";
import type { Linter } from "eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";

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
  // Test-file override. Tests get their OWN budgets, not a blanket pass —
  // they outnumber product files, so exempting them puts most of the repo
  // outside the standard.
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
      // Enabled only where the suite already sits at zero, so each is a
      // guarantee rather than a burn-down. A rule whose zero cannot become
      // nonzero without configuring a list stays off: it would read as cover.
      "vitest/consistent-each-for": "error",
      "vitest/consistent-test-it": "error",
      "vitest/consistent-vitest-vi": "error",
      "vitest/hoisted-apis-on-top": "error",
      "vitest/max-nested-describe": "error",
      "vitest/no-alias-methods": "error",
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
      "vitest/no-test-prefixes": "error",
      "vitest/no-test-return-statement": "error",
      "vitest/no-unneeded-async-expect-function": "error",
      "vitest/prefer-comparison-matcher": "error",
      "vitest/prefer-equality-matcher": "error",
      "vitest/prefer-hooks-on-top": "error",
      "vitest/prefer-hooks-in-order": "error",
      "vitest/prefer-snapshot-hint": "error",
      "vitest/prefer-each": "error",
      "vitest/prefer-to-be": "error",
      "vitest/prefer-to-be-object": "error",
      "vitest/prefer-to-contain": "error",
      "vitest/prefer-to-have-been-called-times": "error",
      "vitest/prefer-to-have-length": "error",
      "vitest/prefer-todo": "error",
      "vitest/prefer-vi-mocked": "error",
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
      // 647 = the Tukey far-out fence Q3 + 3·IQR of the test-file distribution,
      // on the metric `max-lines` itself counts (skipBlankLines + skipComments);
      // p95 = 638 lands beside it. Crossing it prompts a look, not a verdict.
      "max-lines": [
        "error",
        { max: 647, skipBlankLines: true, skipComments: true },
      ],
      // Cyclomatic/cognitive complexity stay off: no defensible
      // arrange-act-assert metric exists, and a number picked at random is
      // worse than no number. `max-lines-per-function` likewise — every
      // describe/it callback is a function, so it would fire on all of them.
      complexity: "off",
      "sonarjs/cognitive-complexity": "off",
      // Test literals (fixture counts, expected values, dates) are the
      // assertion itself — naming each one adds noise, not meaning.
      "@typescript-eslint/no-magic-numbers": "off",
      // Enforced at the src threshold (4). The rule skips test-framework
      // callbacks, so `describe` > `it` cost zero levels and the budget
      // measures real helper nesting exactly as it does in src — the
      // "nested setup callbacks are idiomatic" rationale for exempting it
      // did not survive reading the rule.
      "sonarjs/no-nested-functions": "error",
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
  // JUSTIFIED PERMANENT no-magic-numbers exemptions — files where the numbers
  // ARE the content: naming each one adds indirection without meaning. New
  // logic in other files stays gated.
  {
    files: [
      // Test infrastructure — same footing as the test-file override above.
      "apps/api/src/test-utils/**",
    ],
    rules: { "@typescript-eslint/no-magic-numbers": "off" },
  },
  // UAT route fixtures use repeated literals as data — same footing as the
  // test carve-out above. Scoped to inventory.mjs (the only file that fires);
  // other uat-suite scripts stay under the full rule.
  {
    files: ["apps/web/uat-suite/inventory.mjs"],
    rules: { "sonarjs/no-duplicate-string": "off" },
  },
  //
  // JUSTIFIED PERMANENT sonarjs/cognitive-complexity exempts. Cohesive single
  // concerns where splitting below the threshold fragments logic, breaks
  // memoization, or forces artificial slicing. Permanent (NOT a TODO).
  {
    files: [
      "apps/web/uat-suite/inventory.mjs", // classify() must stay inline (runs inside page.evaluate) + multi-phase report IIFE
    ],
    rules: { "sonarjs/cognitive-complexity": "off" },
  },
  // Playwright's fixture contract is `async ({ deps }, use) => { … await use(x) }`.
  // `use` is the provider callback the runner hands in, and react-hooks matches
  // it by name alone — every hit in this tree is that shape, not a React hook.
  {
    files: ["e2e/**/*.ts"],
    rules: {
      "max-lines": [
        "error",
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      "react-hooks/rules-of-hooks": "off",
    },
  },
];
