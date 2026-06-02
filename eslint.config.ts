import { defineConfig, globalIgnores } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactCompiler from "eslint-plugin-react-compiler";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

// Phase 1 (migrate-lint-to-eslint-prettier): Biome removed; ESLint owns logic,
// Prettier owns format, stylelint owns CSS. This config ports Biome's
// `recommended` surface 1:1 — BEHAVIOR-PRESERVING, NO NEW RULES. The
// max-strictness regime (strictTypeChecked, import-sort, sonarjs, unicorn,
// max-lines, jsdoc) is Phase 2 (declare) + Phase 3 (ratchet), NOT here.
//
// Retained from the residual config: projectService, no-floating-promises
// (type-aware), react-compiler, react-hooks.
// Added to absorb Biome `recommended`: @typescript-eslint individual rules
// (NOT the recommended array — it would smuggle ~20 rules Biome lacks),
// eslint-plugin-react (no-array-index-key, no-danger, …),
// eslint-plugin-jsx-a11y (a11y parity; preset is a pragmatic ~match, NOT exact —
// any jsx-a11y rule with no Biome counterpart that fires NEW must be turned
// off here to preserve 1:1), unused-imports (no-unused-vars parity).
// NOTE: simple-import-sort is intentionally NOT here — Biome does not sort
// imports today (no assist/organizeImports config), so it is net-new and
// belongs to Phase 3.
//
// Phase 2 (declare-lint-max-strictness): the durable max-strictness STANDARD is
// declared spec-first in openspec — capability `lint-max-strictness-standard`
// (the single source of truth). NO live strict rule is enabled here; this gate
// stays exactly as green as Phase 1 left it. Phase 3 (ratchet-lint-to-strict)
// flips each target below from absent → `error` with its fixup wave.
// Phase-3 ratchet targets (see the spec for scope/threshold qualifiers):
//   • base: @typescript-eslint strictTypeChecked + stylisticTypeChecked
//   • plugins: sonarjs (incl. cognitive-complexity ≤ 15), unicorn (pruned
//     off-list), jsdoc (packages/shared + packages/ui public API only),
//     simple-import-sort (net-new), import-boundaries
//   • core: max-lines 300 (skipBlankLines, skipComments), complexity ≤ 10
//   • exempt dirs: *.test.*, e2e, prisma/generated, prisma/seed*.ts, *.config.ts
//   • exclude-list seed (inherited a11y carve-outs, kept off, NOT reopened):
//     jsx-a11y/no-noninteractive-element-interactions,
//     jsx-a11y/label-has-associated-control, the test-file full-a11y-off override
//   • severity reconciliation: no-non-null-assertion → error,
//     jsx-no-useless-fragment → error, no-unused-imports → error,
//     react-hooks/exhaustive-deps → stays warn (advisory, false-positive-prone)
//   • web→api boundary carve-out: import type ALLOWED via
//     @typescript-eslint/no-restricted-imports { allowTypeImports: true }
export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/.next/**",
    "**/.next-e2e/**",
    "**/coverage/**",
    "**/.turbo/**",
    "**/prisma/generated/**",
    "prisma/seed.ts",
    "prisma/seed-simple.ts",
    "prisma/seed-constants.ts",
    "**/e2e/**",
    "openspec/**",
  ]),
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      react,
      "jsx-a11y": jsxA11y,
      "react-hooks": reactHooks,
      "react-compiler": reactCompiler,
      "unused-imports": unusedImports,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "*.config.ts",
            "*.setup.ts",
            "prisma/*.ts",
            "tools/*.ts",
            "apps/*/*.config.ts",
            "apps/*/*.setup.ts",
            "apps/*/*.test.ts",
            "apps/*/instrumentation.ts",
          ],
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 32,
        },
      },
    },
    rules: {
      // Biome repo overrides (preserve severities exactly)
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-unused-vars": "off", // delegated to unused-imports
      "unused-imports/no-unused-vars": [
        "error",
        {
          ignoreRestSiblings: true,
          // Biome convention: leading underscore marks intentionally unused vars/args
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "unused-imports/no-unused-imports": "warn",

      // React rules Biome recommended enforced
      // jsx-no-useless-fragment promoted warn→error in Phase-3 ratchet R2a
      // (declared severity-reconciliation target).
      "react/jsx-no-useless-fragment": "error",
      "react/no-array-index-key": "error",
      "react/no-danger": "error",

      // jsx-a11y parity (pragmatic preset; prune net-new firers to stay 1:1)
      ...jsxA11y.configs.recommended.rules,
      // Net-new firers vs Biome (out of Phase-1 1:1 scope):
      // noNoninteractiveElementInteractions: Biome 2.4.16 has the rule but it is
      //   NOT recommended (default info, must be explicitly enabled). jsx-a11y
      //   enables it via recommended preset → net-new behavior.
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      // noLabelWithoutControl: Biome 2.4.16 DOES have this rule as recommended
      //   (error). However Biome's check accepts wrapping-label patterns (label
      //   wrapping input + sibling span) that jsx-a11y/label-has-associated-control
      //   rejects. All 7 firing sites use the wrapping-label pattern and passed
      //   Biome's check without suppressions → jsx-a11y is stricter here →
      //   behavioral divergence, not enforcement gap. Off to preserve 1:1 surface.
      "jsx-a11y/label-has-associated-control": "off",

      // ESLint core mapped from Biome recommended (warn = won't gate)
      "prefer-rest-params": "error",
      "prefer-template": "warn",
      "no-template-curly-in-string": "warn",
      "no-unused-private-class-members": "warn",

      // Type-aware (retained hard-error + Biome-recommended equivalents)
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/prefer-optional-chain": "warn",

      // Phase-3 ratchet — R1a SAFE autofix cluster (ratchet-lint-to-strict).
      // Purely syntactic / proven-noop rules only. EXCLUDED and deferred to a
      // later reviewed cluster: no-confusing-void-expression & prefer-optional-chain
      // (fixes alter runtime behavior); no-unnecessary-type-assertion &
      // non-nullable-type-assertion-style (the lint program flags assertions the
      // app tsconfig still needs — removing them breaks `tsc`, e.g. `as
      // HTMLInputElement` in RTL tests, `as CompiledHistoryResult`).
      "@typescript-eslint/dot-notation": "error",
      "@typescript-eslint/consistent-type-definitions": "error",
      "@typescript-eslint/array-type": "error",
      "@typescript-eslint/prefer-regexp-exec": "error",
      "@typescript-eslint/consistent-generic-constructors": "error",
      "@typescript-eslint/no-unnecessary-type-arguments": "error",
      "@typescript-eslint/consistent-indexed-object-style": "error",
      "@typescript-eslint/no-unnecessary-template-expression": "error",
      "@typescript-eslint/no-unnecessary-boolean-literal-compare": "error",
      "@typescript-eslint/no-inferrable-types": "error",

      // Phase-3 ratchet — R2a SAFE low-risk cluster (ratchet-lint-to-strict).
      // In-scope declared targets, ascending-risk first wave: two type-aware
      // rules whose fixes are noop/local, and one strict rule (return-await)
      // whose fix is a genuine correctness gain (await inside try so the catch
      // observes async rejections). jsx-no-useless-fragment is promoted in place
      // above (it was already a Phase-1 warn).
      "@typescript-eslint/no-unnecessary-type-conversion": "error",
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",
      "@typescript-eslint/return-await": "error",

      // Phase-3 ratchet — no-deprecated (ratchet-lint-to-strict).
      "@typescript-eslint/no-deprecated": "error",

      // Phase-3 ratchet — R2b-2 (ratchet-lint-to-strict). require-await repo-wide
      // (the declared standard does NOT exempt tests for the type-aware base).
      // src violations are fixed in code; test-mock methods that are async purely
      // to satisfy an async interface contract carry a per-site disable.
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-empty-function": "error",
      // Phase-3 ratchet — R2b-3 wave-2 (ratchet-lint-to-strict).
      // allowWithDecorator exempts decorated classes: in this NestJS codebase
      // an empty `@Module` class is correct by design (the decorator carries
      // the provider/import metadata). This is the rule's built-in
      // framework-accommodation option, NOT a weakening — the rule still fires
      // on genuinely extraneous (non-decorated) classes. The 6 remaining
      // test-mock sites (inert `@nestjs/common` lifecycle stubs in vi.mock
      // factories) carry per-site disables with reasons.
      "@typescript-eslint/no-extraneous-class": [
        "error",
        { allowWithDecorator: true },
      ],
      // Phase-3 ratchet — R2b-3 wave-2 last cluster (ratchet-lint-to-strict).
      // Riskiest of the wave: every firing is a real correctness question
      // (a Promise used where a void/boolean is expected). Fixed per-site to
      // preserve intended behavior; no eslint-disable escape is permitted here.
      "@typescript-eslint/no-misused-promises": "error",

      // React hooks (single-owned by ESLint)
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // React Compiler (React 19, no Biome equivalent)
      "react-compiler/react-compiler": "error",
    },
  },
  // Test-file override: disable jsx-a11y (mirrors Biome's former a11y:off on tests)
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: Object.fromEntries(
      Object.keys(jsxA11y.configs.recommended.rules).map((rule) => [
        rule,
        "off",
      ]),
    ),
  },
]);
