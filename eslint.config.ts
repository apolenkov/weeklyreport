import type { ESLint, Linter } from "eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import jsdoc from "eslint-plugin-jsdoc";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactCompiler from "eslint-plugin-react-compiler";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import sonarjs from "eslint-plugin-sonarjs";
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
// sonarjs ships its flat `recommended` config typed as a loose union; narrow it
// to the rules/settings shape we spread so the type-aware lint stays clean.
const sonarjsRecommended = sonarjs.configs.recommended as unknown as {
  readonly rules: Linter.RulesRecord;
  readonly settings?: Linter.Config["settings"];
};

// jsdoc: the TypeScript-flavored recommended preset (TS supplies types, so the
// type-requiring jsdoc rules are off — validates jsdoc CORRECTNESS, not presence;
// no require-jsdoc, which would be the "overhead" the user flagged).
const jsdocRecommendedTs = jsdoc.configs["flat/recommended-typescript"] as {
  readonly rules: Linter.RulesRecord;
};

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
    "prisma/seed-demo.ts",
    "prisma/seed-constants.ts",
    "**/e2e/**",
    "openspec/**",
    // Workflow-harness scripts (the `Workflow` tool wraps these in an async
    // function and injects args/log/parallel/agent), so they legitimately use
    // top-level return/await and are not standalone modules — linting them as
    // such only produces false "return outside of function" parse errors.
    "**/*.workflow.mjs",
    ".claude/workflows/**",
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
            "apps/*/instrumentation-client.ts",
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
      "unicorn/dom-node-dataset": "error",
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
  // R3a-3: sonarjs (community recommended preset). Per the §3 user directive
  // (community-strict, no overhead, default presets win), the full recommended
  // ruleset is enabled — every rule that currently fires ZERO times is enforced
  // going forward (regression prevention). The 29 rules that DO fire today are
  // turned off below in two buckets: PRUNE (permanent — noise/duplicate/
  // convention-conflict) and DEFER (a ratchet TODO — flip to error per fixup
  // wave, same model as the max-lines/complexity ratchet). No code was changed
  // to land this; the deferred fixups are tracked in tasks.md R3a-3.
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    plugins: { sonarjs },
    settings: sonarjsRecommended.settings,
    rules: {
      ...sonarjsRecommended.rules,
      // — PRUNE (permanent off, with reason) —
      "sonarjs/todo-tag": "off", // fights the repo-mandated TODO(<ref>) deferred-feature convention (CLAUDE.md)
      "sonarjs/no-unused-vars": "off", // duplicate of unused-imports/no-unused-vars (already error)
      "sonarjs/deprecation": "off", // duplicate of @typescript-eslint/no-deprecated (already error)
      "sonarjs/prefer-read-only-props": "off", // aggressive React-prop-immutability churn (49 sites), suggestion-only, not standard practice
      "sonarjs/no-nested-conditional": "off", // nested ternaries are idiomatic in JSX rendering here (105 sites); cognitive-complexity already bounds nesting
      // — DEFER (ratchet TODO(R3a-3-fixup): grandfathered repo-wide for now,
      //   flip to error one fixup wave at a time). Counts measured 2026-06-09. —
      // R3a-3-fixup WAVE 3 (2026-06-09) — complexity close-out. Read-only
      // per-file assessment (35-agent Workflow) confirmed the prior census:
      // these hotspots are cohesive single concerns where splitting below the
      // threshold fragments logic / breaks memoization (the overnight army
      // proved it). Accepted as justified-permanent file exempts (below), same
      // end-state as max-lines R3a-4; new code stays gated.
      "sonarjs/cognitive-complexity": "error",
      "sonarjs/no-nested-functions": "error",
      // R3a-3-fixup wave 1: enforced in src (regression prevention); the only
      // current firings are fake fixtures (10.0.0.x IPs, fake passwords) in
      // test files, scoped off in the test-file override below.
      "sonarjs/no-hardcoded-ip": "error",
      "sonarjs/hardcoded-secret-signatures": "error",
      // R3a-3-fixup WAVE 2 (2026-06-09): the following were triaged site-by-site
      // (read-only Workflow census + skeptical verify), then fixed/disabled
      // sequentially with each diff read. Behavior-sensitive rules (slow-regex,
      // no-alphabetical-sort, pseudo-random) are per-site-disabled with reasons,
      // NOT rewritten. 4 rules also need a test-file carve-out (below) where the
      // firing is inherent to test code.
      "sonarjs/no-clear-text-protocols": "error", // src: jsonTransport false-positive disabled; tests carved out
      "sonarjs/no-alphabetical-sort": "error", // src: 4 stable-hash sorts per-site-disabled (determinism); tests carved out
      "sonarjs/slow-regex": "error", // 5 src: linear regexes per-site-disabled (incl. prod DB guard — NOT rewritten)
      "sonarjs/pseudo-random": "error", // 2 src: UI variety, per-site-disabled (not crypto)
      "sonarjs/no-os-command-from-path": "error", // 2 src: pnpm in dev reset script, per-site-disabled
      "sonarjs/os-command": "error", // 1 src: execSync → execFileSync (arg-array) in uat script
      "sonarjs/no-nested-template-literals": "error", // 5 src: const-lifted, output byte-identical
      "sonarjs/use-type-alias": "error", // src: extracted shared literal-union aliases; 1 Prisma shape disabled
      "sonarjs/no-misleading-array-reverse": "error", // src+test: copy-then-reverse where source unused
      "sonarjs/no-redundant-optional": "error", // test: dropped redundant `| undefined`
      "sonarjs/no-unused-collection": "error", // test: removed dead collection; 1 intentional disabled
      "sonarjs/public-static-readonly": "error", // test: added readonly modifier
      "sonarjs/no-invariant-returns": "error", // src: startOtel returns decision by design, per-site-disabled
      "sonarjs/reduce-initial-value": "error", // src: explicit editDates[0] seed (array always non-empty)
      "sonarjs/no-async-constructor": "error", // src: logger serial-write queue, per-site-disabled
      "sonarjs/function-return-type": "error", // src: Component.render override, per-site-disabled
      "sonarjs/void-use": "error", // src: dropped `void tz` for `_tz` unused-param convention
      // test-only firings; rule stays error in src, carved out in the test override below:
      "sonarjs/no-identical-functions": "error", // test: idiomatic render-wrapper duplication
      "sonarjs/no-undefined-argument": "error", // test: intentional undefined-arg legacy-contract checks
      // R3a-3-fixup wave 3: verified via the TS language server — `i.id`
      // (string | undefined) vs `record.sourceId` (string | null) overlap on
      // `string`, so the comparison is meaningful (match by id); the null/
      // undefined asymmetry is harmless. 2 sites per-site-disabled in
      // carry-over.service. NOT an always-false bug.
      "sonarjs/different-types-comparison": "error",
    },
  },
  // R3b: jsdoc — TS-flavored recommended, scoped to the two published packages'
  // public surface (packages/shared + packages/ui) per the scaffold directive.
  // Tests are not public source: excluded so docblock pragmas like
  // `@vitest-environment` are not mis-flagged as invalid jsdoc tags.
  {
    files: ["packages/shared/src/**/*.ts", "packages/ui/src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/__tests__/**"],
    plugins: { jsdoc },
    rules: {
      ...jsdocRecommendedTs.rules,
      // PRUNE: require-jsdoc forces a doc block on every export (126 sites) —
      // the presence-overhead the user flagged. We validate jsdoc CORRECTNESS
      // (require-param/returns, check-tag-names, …) where blocks exist, not
      // their presence. Flip to error with content in a dedicated docs pass.
      "jsdoc/require-jsdoc": "off",
    },
  },
  // R3c: import boundary — apps/web must not import apps/api at RUNTIME. The tRPC
  // client legitimately needs the AppRouter *type* (apps/web/src/lib/trpc.ts), so
  // type-only imports are allowed via allowTypeImports; a VALUE import would pull
  // the Nest/Prisma server graph into the browser bundle. Currently 0 violations.
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@customreport/api", "@customreport/api/*"],
              allowTypeImports: true,
              message:
                "apps/web must not import apps/api at runtime; only `import type` is allowed (e.g. AppRouter for the tRPC client).",
            },
          ],
        },
      ],
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
      // R3a-3-fixup wave 3: tests are exempt from complexity budgets (same as
      // the core `complexity`/`max-lines` above) — long arrange/act/assert
      // bodies and nested setup callbacks are idiomatic test structure.
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/no-nested-functions": "off",
      // R3a-3-fixup wave 1: test fixtures legitimately embed fake IPs and
      // fake secrets (10.0.0.x audit-log samples, dummy PDF-export passwords).
      // The rules stay `error` in src; tests are exempt by design.
      "sonarjs/no-hardcoded-ip": "off",
      "sonarjs/hardcoded-secret-signatures": "off",
      // R3a-3-fixup wave 2: firings inherent to test code (the rules stay `error`
      // in src). http:// fixtures for local collectors/IP URLs; intentional
      // undefined args for legacy-contract checks; idiomatic duplicate render
      // wrappers; bare .sort() in test assertions.
      "sonarjs/no-clear-text-protocols": "off",
      "sonarjs/no-undefined-argument": "off",
      "sonarjs/no-identical-functions": "off",
      "sonarjs/no-alphabetical-sort": "off",
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
      // Long-tail (300-500), R3a-4 triage (wf wzrtmlhbc, confirmed by hand):
      // each is one cohesive concern where a split would shed few lines at a
      // clarity cost — exempt, not churn.
      "apps/api/src/infrastructure/trpc/trpc.middleware.ts", // tRPC instance + all procedure builders share the private `t` binding
      "apps/api/src/modules/admin/period-admin.service.ts", // one Admin period-lifecycle service class
      "apps/api/src/modules/auth/auth.routes.ts", // one post-auth chain; helpers private to buildUserSession
      "apps/api/src/modules/report-sections/report-sections.prisma-repository.ts", // one Prisma persistence layer; include/type/mapper/class coupled
      "apps/web/src/components/admin/users-tab.tsx", // one CRUD panel; table + dialogs share one state tree
      "apps/web/src/components/admin/groups-tab.tsx", // one CRUD tab; dialogs share one state machine
      "apps/web/src/components/admin/products-tab.tsx", // one CRUD screen; private icon helpers only
      "apps/web/src/components/lead/risk-edit-dialog.tsx", // one dialog: state + validation + render
      "apps/web/src/components/lead/item-edit-dialog.tsx", // one create/edit dialog; shell + content coupled
      "apps/web/src/components/lead/lead-form-sync-bridge.tsx", // one context bridge wiring sync to two consumers
      "apps/web/src/components/slides/status-slide-deck.tsx", // one navigable slide-deck widget
      "apps/web/src/components/navigation/nav-bar.tsx", // one role-aware nav widget; MobileNav/coming-soon have no external consumers
      "apps/web/src/components/dashboard/dashboard-page.tsx", // one head-dashboard page; private load-issue helper only
      "apps/web/src/components/weekly-report/product-accordion.tsx", // one accordion for one ProductReport
      "apps/web/src/components/weekly-report/weekly-report-page.tsx", // one page: data load + 3 mutations + render
      "apps/web/src/lib/mappers/lead-form.ts", // one LeadForm mapping pipeline; types-out alone stays >300, further split fragments it
      // R3a-4 god-files (700+) triaged to permanent-exempt: a namespace split is
      // mechanically possible but would not improve the file (per code-style: keep
      // the larger unit and say why). See wf wjqkbxhc3.
      "apps/api/src/infrastructure/trpc/trpc.router.ts", // single tRPC god-router; all 17 namespace sub-routers close over one RouterDeps; real fix is service-layer extraction, not a shell split
      "apps/api/src/modules/report-sections/lead-form.prisma-repository.ts", // one DI provider for one LeadFormRepository interface; domain separation already lives at the service layer above it
      "apps/web/src/components/lead/lead-form.tsx", // monolithic component; 6 queries/5 mutations/~15 state vars share one scope; best-case extraction still leaves ~1440 lines — needs multi-PR architectural work, not a mechanical split
      "apps/web/src/components/slides/section-slide-utils.ts", // core mapper buildSectionSlideModel (247 lines) + its private helpers are inseparable; extracting all else still leaves ~335 lines
    ],
    rules: { "max-lines": "off" },
  },
  // R3a-4 GRANDFATHER (max-lines) — EMPTY. The ratchet is complete: every
  // pre-existing violator was either split below 300 or moved to the
  // justified-permanent exempt block above with a reason. No file is
  // size-grandfathered any longer.
  //
  // R3a-3-fixup WAVE 3 (2026-06-09) — JUSTIFIED PERMANENT complexity exempts
  // (cyclomatic > 20). Each file was assessed read-only, one agent per file
  // (35-agent Workflow), and confirmed a cohesive single concern where
  // splitting below the threshold fragments logic, breaks memoization, or is
  // forced artificial slicing. The overnight refactor army proved blind splits
  // pass the gate but break behavior. Accepted as permanent (NOT a TODO), same
  // end-state as the max-lines block; `complexity: 20` still gates new code.
  {
    files: [
      "apps/api/src/modules/auth/auth.routes.ts", // 3 Express auth handlers; env-conditional mount order (dev before passport) is load-bearing
      "apps/web/src/app/(app)/reports/page.tsx", // role-aware history renderer; 5 roles × distinct query/filter/label paths
      "apps/web/src/components/admin/admin-panel.tsx", // 9-tab dispatch + skeleton/loaded gating; only ~3 pts extractable
      "apps/web/src/components/dashboard/dashboard-page.tsx", // orchestrator: 2 queries + shared state + 4 render branches, hook-coupled
      "apps/web/src/components/lead/decision-edit-dialog.tsx", // one create/edit dialog; per-field validation + conditional fields
      "apps/web/src/components/lead/item-edit-dialog.tsx", // one form dialog; interdependent state (text/status/product/priority/stages)
      "apps/web/src/components/lead/lead-form.tsx", // monolith; aggregateTrafficLight + state-setter pipelines; multi-PR architectural work
      "apps/web/src/components/lead/lead-history-sidebar.tsx", // status-card multi-branch messaging (streak/viewer/draft/risk)
      "apps/web/src/components/lead/next-week-section.tsx", // kanban CRUD + discriminated-union dialog state + grouped columns
      "apps/web/src/components/lead/risk-edit-dialog.tsx", // one dialog; validation coupled to 7+ form fields; 'use no memo' race guard
      "apps/web/src/components/lead/risks-section.tsx", // 3 dialog states across handlers + JSX; prior split broke behavior
      "apps/web/src/components/lead/stage-chip.tsx", // interactive chip; dropdown/status/clear/popover entangled via hooks
      "apps/web/src/components/navigation/nav-bar.tsx", // role-based link filtering + session/hydration across layout slots
      "apps/web/src/components/slides/head-slides-client.tsx", // guard clauses (loading/error/data) + scope-driven slide build
      "apps/web/src/components/slides/lead-slides-client.tsx", // hooks + shared state + loading/error/empty returns drive the deck lifecycle
      "apps/web/src/components/slides/section-slide-utils.ts", // 4 domain transforms; branch count inherent to the data they model
      "apps/web/src/components/weekly-report/product-accordion.tsx", // 6 status-aware sections; uniform accordion pattern
      "apps/web/src/components/weekly-report/weekly-report-page.tsx", // role-aware state machine: query status + publish + filter + grouping
    ],
    rules: { complexity: "off" },
  },
  // R3a-3-fixup wave 3 — JUSTIFIED PERMANENT sonarjs/cognitive-complexity
  // exempts. Same per-file read-only assessment + rationale as the cyclomatic
  // block above (many files overlap — the same cohesive monoliths).
  {
    files: [
      "apps/api/src/infrastructure/trpc/trpc.middleware.ts", // start/finish request logging + error capture in one lifecycle closure
      "apps/api/src/infrastructure/trpc/trpc.router.ts", // wipeAndReseed dispatch + compiledHistory 5-loop accumulator
      "apps/api/src/modules/admin/admin-settings.queries.ts", // 19-field schema→update mapping; complexity is schema width, not branching
      "apps/api/src/modules/admin/admin-snapshot-write.queries.ts", // role-aware user upsert + FK-guarded deletion
      "apps/api/src/modules/admin/period-admin.service.ts", // manual period edit + per-field audit diff (only layer with before+after)
      "apps/api/src/modules/analytics/analytics.prisma-repository.ts", // 3-level traversal (reports→sections→statuses) → period×project matrix
      "apps/web/src/app/(app)/reports/page.tsx", // see cyclomatic block (same role-aware renderer)
      "apps/web/src/components/dashboard/remind-lead-button.tsx", // one ConfirmState machine → label/message/icon/disabled
      "apps/web/src/components/lead/lead-form.tsx", // see cyclomatic block (same monolith)
      "apps/web/src/components/lead/lead-history-sidebar.tsx", // see cyclomatic block
      "apps/web/src/components/lead/risks-section.tsx", // see cyclomatic block
      "apps/web/src/components/lead/stage-chip.tsx", // see cyclomatic block
      "apps/web/src/components/slides/section-slide-utils.ts", // see cyclomatic block
      "apps/web/src/components/slides/status-slide-deck.tsx", // lead/head modes + sidebar/control/fallback render branches
      "apps/web/src/components/weekly-report/product-accordion.tsx", // see cyclomatic block
      "apps/web/uat-suite/inventory.mjs", // classify() must stay inline (runs inside page.evaluate) + multi-phase report IIFE
    ],
    rules: { "sonarjs/cognitive-complexity": "off" },
  },
  // R3a-3-fixup wave 3 — JUSTIFIED PERMANENT sonarjs/no-nested-functions
  // exempts. Nested callbacks inside render/state-setter pipelines or browser-
  // serialized scripts; extracting fragments the concern or breaks memoization.
  {
    files: [
      "apps/web/src/components/landing/tagline-cycler.tsx", // self-recursive setTimeout handler mutating timer/visible/index state
      "apps/web/src/components/lead/lead-form.tsx", // array-transform pipelines inside React state setters
      "apps/web/src/hooks/use-status-risk.ts", // arrow callbacks in state-update chains; consolidated to avoid loops via syncSourceRef
      "apps/web/src/lib/trpc.ts", // RxJS observer/cleanup handlers in the error-link middleware
    ],
    rules: { "sonarjs/no-nested-functions": "off" },
  },
]);
