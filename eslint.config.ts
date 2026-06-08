import type { ESLint, Linter } from "eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactCompiler from "eslint-plugin-react-compiler";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unicorn from "eslint-plugin-unicorn";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

// eslint-plugin-jsx-a11y ships no type declarations, so its default import is
// implicitly `any` — the root of every no-unsafe-* firing in this config.
// Describe the surface this file actually touches (the recommended preset's
// rules + a valid plugin shape) so the rules have a concrete type to check.
const jsxA11y = jsxA11yPlugin as ESLint.Plugin & {
  configs: { recommended: { rules: Linter.RulesRecord } };
};

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
    "**/.next-sweep/**",
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
      "simple-import-sort": simpleImportSort,
      unicorn,
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
      // Phase 3 (ratchet-lint-to-strict) R3a — net-new ordering/naming cluster.
      // simple-import-sort: deterministic import/export order (autofixable).
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      // R3a-2: unicorn — a CURATED allowlist, not the recommended preset.
      // Directive: community-strict, no overhead, AI-controlled. The full
      // `recommended` set (3266 firings) is dominated by two notorious rules
      // (prevent-abbreviations, no-null) plus several whose AUTOFIX introduces
      // bugs/regressions here — measured: prefer-https rewrites the SVG XML
      // namespace `http://www.w3.org/2000/svg` (an identifier, not a URL) to
      // https and breaks the SVG; prefer-spread turns `Array.from(domCollection)`
      // into a spread that loses TS typing (no-unsafe-*); no-useless-undefined
      // rewrites `() => undefined` into `() => {}` (empty-function). So enable
      // only the safe, high-value, autofix-clean rules:
      "unicorn/escape-case": "error",
      // unicorn/number-literal-case is intentionally NOT enabled: it conflicts
      // with Prettier (the formatter of record). The rule wants UPPERCASE hex
      // digits (0x1F) while Prettier lowercases them (0x1f); since the pre-commit
      // hook runs prettier AFTER eslint --fix, every hex literal with a letter
      // digit lands committed-red. Prettier already lowercases the 0x/0b/0o
      // prefix and the `e` exponent, so the rule is redundant apart from the
      // conflicting hex-digit case. (Latent since R3a-2; surfaced by R3a-4's
      // repo-wide gate on logger.test.ts 0x1f/0x8b.)
      "unicorn/numeric-separators-style": "error",
      "unicorn/catch-error-name": "error",
      "unicorn/prefer-string-raw": "error",
      "unicorn/prefer-string-replace-all": "error",
      "unicorn/prefer-string-repeat": "error",
      "unicorn/prefer-node-protocol": "error",
      "unicorn/prefer-number-properties": "error",
      "unicorn/consistent-existence-index-check": "error",
      "unicorn/prefer-includes": "error",
      "unicorn/prefer-dom-node-append": "error",
      "unicorn/prefer-dom-node-dataset": "error",
      "unicorn/prefer-optional-catch-binding": "error",
      "unicorn/prefer-set-has": "error",
      "unicorn/explicit-length-check": "error",
      "unicorn/no-lonely-if": "error",
      "unicorn/no-unnecessary-nested-ternary": "error",
      "unicorn/no-useless-fallback-in-spread": "error",
      "unicorn/consistent-date-clone": "error",
      "unicorn/no-unnecessary-array-splice-count": "error",
      "unicorn/prefer-type-error": "error",
      "unicorn/require-css-escape": "error",
      // Dropped (left non-autofixable stragglers that fight intentional code):
      // no-useless-switch-case (explicit `case X: default:` documents known enum
      // values), prefer-query-selector / better-dom-traversing / text-encoding-
      // identifier-case / prefer-logical-operator-over-ternary (borderline value,
      // autofix self-declined on type/nullish nuance).
      // Several recommended rules are NOT enabled because their autofix breaks
      // types/behavior in this typed codebase (all caught by the gate):
      //  • no-useless-undefined — strips required explicit `undefined`
      //    (`safeParse(undefined)`→`safeParse()`; `calledWith({},undefined)`→`({})`).
      //  • prefer-native-coercion-functions — `.filter((x): x is string =>
      //    Boolean(x))`→`.filter(Boolean)` drops the type predicate (string|undefined).
      //  • prefer-math-min-max — `date > latest ? date : latest`→`Math.max(...)`
      //    returns number where a Date is required.
      //  • prefer-https / prefer-spread — break the SVG XML namespace / lose DOM types.
      // unicorn/filename-case with our ignore patterns:
      "unicorn/filename-case": [
        "error",
        {
          case: "kebabCase",
          // Framework/test directory conventions are not source files — exempt
          // them from kebab: Next.js dynamic route segments (`[reportId]`, whose
          // name IS the `params` key and must stay camelCase) and the `__tests__`
          // test-folder convention.
          ignore: [String.raw`^\[.+\]$`, "^__tests__$"],
        },
      ],
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
      // Phase-3 ratchet — R2b-4 wave-4 (ratchet-lint-to-strict). strictTypeChecked
      // sets every allow:false (202 firings here), but 184 are a plain `${number}`
      // and a handful are `${boolean}` — both safe, idiomatic interpolation. Per
      // the spec's "built-in option is a config choice, not a weakening" scenario
      // (same precedent as no-extraneous-class allowWithDecorator), allowNumber +
      // allowBoolean scope the rule to its dominant noise instead of churning ~190
      // mechanical String() wraps. The rule still fires on the genuinely-risky
      // shapes (any, nullish, never, RegExp), which were fixed by hand at the
      // source (e.g. typing DATABASE_URL as string in the destructive guard).
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowAny: false,
          allowBoolean: true,
          allowNever: false,
          allowNullish: false,
          allowNumber: true,
          allowRegExp: false,
        },
      ],
      // Phase-3 ratchet — R2b-5 wave-5 (ratchet-lint-to-strict).
      // prefer-nullish-coalescing: SOFTENED from strictTypeChecked's default via
      // `ignorePrimitives: { string: true }` (a deliberate relaxation, documented
      // as such). 20 of 23 firings are string `||` where an empty string is a
      // meaningful fall-through (id/label/description defaults: `name || "—"`,
      // `productId || "" `, `week || range || "…"`); for strings `||` and `??`
      // differ only on "", and here "" SHOULD fall through, so `||` is the
      // intended idiom, not a bug. Trade-off: this blinds the rule to future
      // string `||` (incl. genuine ones). The 3 non-string firings were fixed by
      // hand (`?? 0`, `??=`, ternary→`??`); the rule still guards number/boolean/
      // object `||`.
      "@typescript-eslint/prefer-nullish-coalescing": [
        "error",
        { ignorePrimitives: { string: true } },
      ],
      // unbound-method: every firing is in a test — a vitest spy assertion
      // (`expect(mock.method)`) or mock-cast where the reference is a vi.fn with
      // no `this`, so they carry a per-site disable with reason. The one genuine
      // method-capture (reminders.scheduler.test) was fixed with `.bind`, not a
      // disable.
      "@typescript-eslint/unbound-method": "error",
      // no-base-to-string: 7 real "[object Object]" risks on `unknown` operands
      // (SAML profile fields, generic data-table cells, a spawn error's stderr),
      // each fixed by narrowing to a string at the source — no disables.
      "@typescript-eslint/no-base-to-string": "error",
      // Phase-3 ratchet — R2b-6 wave-6a (ratchet-lint-to-strict).
      // no-confusing-void-expression: SOFTENED via `ignoreArrowShorthand: true`
      // (a deliberate relaxation from strictTypeChecked's default, documented as
      // such). 270 of 274 firings are arrow-shorthand void returns — idiomatic
      // React event handlers (`onClick={() => setOpen(true)}`) where the void
      // return is intended, not confusing. This softening opens NO Promise hole:
      // the only dangerous arrow-shorthand-void case is a Promise-returning call
      // in a void slot, and `no-misused-promises` (error since wave 2, with the
      // default checksVoidReturn) already rejects that. The 4 remaining real
      // firings — explicit `return <void-call>()` from block-bodied functions in
      // main.ts and sidebar.tsx — were fixed by hand (statement + bare `return`).
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true },
      ],
      // Phase-3 ratchet — R2b-6 wave-6b (ratchet-lint-to-strict): the `any`-flow
      // family. 218 firings (54 src / 160 test). Every src firing was fixed at
      // its ROOT by giving the value a real type instead of `any` — typed Prisma
      // payloads (Prisma.ReportGetPayload / the shared PrismaReportSectionWith-
      // Relations cast), `getInstance() as express.Express`, a structural
      // PrismaLogEventEmitter for Prisma 7's $on, `: unknown` boundary
      // annotations, and a typed tRPC-proxy shim — NET REMOVING several former
      // no-explicit-any disables. One firing surfaced a real masked `null`
      // (projectStatuses[].status). Test firings were typed at their any-source
      // (JSON.parse → Record<string, unknown>, mock casts), with a documented
      // per-site disable only where no real type is reachable. No rule option is
      // softened here — the family runs at full strictTypeChecked strength.
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      // Phase-3 ratchet — R2b-6 wave-6c-i (ratchet-lint-to-strict).
      // non-nullable-type-assertion-style: 9 firings, all `x as T` where T is the
      // non-null form of x (i.e. equivalent to `x!`). NOT converted to `!` (that
      // would seed the declared no-non-null-assertion→error target with new debt);
      // instead each was removed at the ROOT so no assertion is needed: the 3 src
      // `d.productId as string` sites turned their upstream `.filter(d => !!d.productId)`
      // into a type-predicate filter (`d is typeof d & { productId: string }`),
      // narrowing productId to string honestly; the test sites dropped the
      // assertion (non-optional tuple element / `map.get(k) ?? null`). 0 disables.
      "@typescript-eslint/non-nullable-type-assertion-style": "error",
      // Phase-3 ratchet — R2b-6 wave-6c-ii (ratchet-lint-to-strict).
      // no-unnecessary-type-assertion: 134 firings (44 src / 90 test). The
      // autofix removed the genuinely-redundant assertions across 40 files
      // cleanly (verified by tsc). The 9 remaining files carry a file-level
      // single-rule disable, NOT a removal: they hit a documented ESLint-vs-
      // tsc mismatch where ESLint's type-aware program judges an assertion
      // redundant but the app tsconfig still needs it — 8 RTL test files cast
      // `getByLabelText(...)` to a concrete element (HTMLInputElement etc.) to
      // reach .value/.checked/.options (TS2339 without it), and lead-form.tsx
      // casts a ternary to a literal union (TS2322 without it). File-level
      // (not line) disables here are position-independent — immune to the
      // pre-commit-prettier comment-shift hazard (R4a finding (a)).
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      // Phase-3 ratchet — R2b-6 wave-6c-iii (ratchet-lint-to-strict). The last
      // and most behaviour-sensitive cluster: 225 firings, no option lever.
      // Dominant root cause: `noUncheckedIndexedAccess` is OFF, so `arr[i]` is
      // typed non-null though an out-of-bounds index is `undefined` at runtime —
      // every `arr[i] ?? x` / `arr[i]?.y` fired as "unnecessary" while being a
      // REAL guard. Fixed at the ROOT with `arr.at(i)` (honestly `T | undefined`),
      // NOT by deleting the guard. Honestly-dead guards (Prisma model fields,
      // Zod-defaulted inputs, narrowed locals, tRPC error.message, role-validated
      // Record lookups) were removed; genuine type-lies at boundaries that have no
      // clean type fix carry a per-site disable with a reason (external lib /
      // queue / DOM / sparse Record / optimistic query contract). The full test
      // suite caught two optimistic-contract lies (Phase-55 `ci`, synthetic-ctx
      // `req.headers`) that typecheck could not — both now guarded + disabled.
      "@typescript-eslint/no-unnecessary-condition": "error",

      // React hooks (single-owned by ESLint)
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // React Compiler (React 19, no Biome equivalent)
      "react-compiler/react-compiler": "error",

      // R3a-4 (ratchet): file size + cyclomatic complexity. `max-lines` counts
      // real code lines only (skipBlankLines + skipComments); `complexity` uses
      // the ESLint default of 20 (community best-practice — 10 would be ~87
      // functions of churn per the directive's "no overhead"; cognitive-15 is
      // sonarjs's job in R3a-3). The rule is ACTIVE repo-wide so any NEW 300+
      // file / 20+ function fails immediately. Pre-existing violators are
      // grandfathered in the override blocks at the end of this config and
      // ratcheted down one batch at a time.
      "max-lines": [
        "error",
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["error", 20],
    },
  },
  // Test-file override: disable jsx-a11y (mirrors Biome's former a11y:off on
  // tests) and exempt size/complexity budgets (tests routinely exceed them).
  {
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/__tests__/**",
    ],
    rules: {
      ...Object.fromEntries(
        Object.keys(jsxA11y.configs.recommended.rules).map((rule) => [
          rule,
          "off",
        ]),
      ),
      "max-lines": "off",
      complexity: "off",
    },
  },
  // Tooling files are not product source — exempt from size/complexity budgets
  // (eslint.config.ts itself is 400+ lines; *.config.ts / *.setup.ts likewise).
  {
    files: ["**/*.config.ts", "**/*.setup.ts", "tools/**"],
    rules: { "max-lines": "off", complexity: "off" },
  },
  // R3a-4: JUSTIFIED PERMANENT max-lines exemptions — data / generated / one-off
  // script / bootstrap, where splitting would not improve clarity (per
  // ~/.claude code-style: "if splitting would hurt clarity, keep the larger
  // unit and say why"). These are the documented end-state exempts, NOT TODO.
  {
    files: [
      "apps/web/src/components/dashboard/mock-data.ts", // fixture data, no logic
      "apps/web/src/components/lead/mock-data.ts", // fixture data, no logic
      "apps/web/src/components/admin/mock-data.ts", // fixture data, no logic
      "packages/ui/src/components/ui/sidebar.tsx", // shadcn/ui generated primitive bundle
      "prisma/wipe-manual-uat.ts", // one-off operational script (cf. seeds, ignored)
      "packages/shared/src/schemas/report.schema.ts", // dense Zod schema catalogue, no logic
      "apps/api/src/main.ts", // bootstrap; load-order documentation, not splittable
    ],
    rules: { "max-lines": "off" },
  },
  // R3a-4 GRANDFATHER — pre-existing max-lines violators being ratcheted down one
  // batch at a time. NOT permanent: each entry is either split below 300 (then
  // removed here) or, after review, moved to the justified-exempt block above
  // with a reason. The goal state is an EMPTY list.
  {
    files: [
      "apps/api/src/infrastructure/trpc/trpc.router.ts",
      "apps/api/src/infrastructure/trpc/trpc.middleware.ts",
      "apps/api/src/modules/admin/admin.prisma-repository.ts",
      "apps/api/src/modules/admin/period-admin.service.ts",
      "apps/api/src/modules/auth/auth.routes.ts",
      "apps/api/src/modules/report-sections/lead-form.prisma-repository.ts",
      "apps/api/src/modules/report-sections/report-sections.prisma-repository.ts",
      "apps/api/src/lib/audit-logger.ts",
      // Brackets escaped: in a glob, [reportId] is a char-class, not a literal dir.
      String.raw`apps/web/src/app/print/\[reportId\]/page.tsx`,
      "apps/web/src/components/admin/settings-tab.tsx",
      "apps/web/src/components/admin/periods-tab.tsx",
      "apps/web/src/components/admin/reminders-tab.tsx",
      "apps/web/src/components/admin/users-tab.tsx",
      "apps/web/src/components/admin/groups-tab.tsx",
      "apps/web/src/components/admin/products-tab.tsx",
      "apps/web/src/components/lead/lead-form.tsx",
      "apps/web/src/components/lead/risk-edit-dialog.tsx",
      "apps/web/src/components/lead/item-edit-dialog.tsx",
      "apps/web/src/components/lead/decision-edit-dialog.tsx",
      "apps/web/src/components/lead/lead-form-sync-bridge.tsx",
      "apps/web/src/components/slides/section-slide-utils.ts",
      "apps/web/src/components/slides/status-slide-deck.tsx",
      "apps/web/src/components/navigation/nav-bar.tsx",
      "apps/web/src/components/dashboard/dashboard-page.tsx",
      "apps/web/src/components/weekly-report/product-accordion.tsx",
      "apps/web/src/components/weekly-report/weekly-report-page.tsx",
      "apps/web/src/lib/mappers/lead-form.ts",
      "apps/web/src/lib/mappers/admin.ts",
    ],
    rules: { "max-lines": "off" },
  },
  // R3a-4 GRANDFATHER — pre-existing complexity (cyclomatic > 20) violators.
  // Fixed AFTER the max-lines splits land (splitting reduces per-function
  // complexity as a side effect), then the residual is refactored or documented.
  // NOT permanent.
  {
    files: [
      "apps/api/src/modules/admin/admin.prisma-repository.ts",
      "apps/api/src/modules/auth/auth.routes.ts",
      "apps/web/src/app/(app)/reports/page.tsx",
      "apps/web/src/app/login-page.client.tsx",
      "apps/web/src/components/admin/admin-panel.tsx",
      "apps/web/src/components/dashboard/dashboard-page.tsx",
      "apps/web/src/components/lead/current-week-section.tsx",
      "apps/web/src/components/lead/decision-edit-dialog.tsx",
      "apps/web/src/components/lead/item-card.tsx",
      "apps/web/src/components/lead/item-edit-dialog.tsx",
      "apps/web/src/components/lead/lead-form.tsx",
      "apps/web/src/components/lead/lead-history-sidebar.tsx",
      "apps/web/src/components/lead/next-week-section.tsx",
      "apps/web/src/components/lead/risk-edit-dialog.tsx",
      "apps/web/src/components/lead/risks-section.tsx",
      "apps/web/src/components/lead/stage-chip.tsx",
      "apps/web/src/components/navigation/nav-bar.tsx",
      "apps/web/src/components/slides/head-slides-client.tsx",
      "apps/web/src/components/slides/lead-slides-client.tsx",
      "apps/web/src/components/slides/section-slide-utils.ts",
      "apps/web/src/components/weekly-report/product-accordion.tsx",
      "apps/web/src/components/weekly-report/weekly-report-page.tsx",
    ],
    rules: { complexity: "off" },
  },
]);
