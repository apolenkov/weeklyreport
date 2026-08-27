/// <reference path="../tools/types/eslint-plugin-jsx-a11y.d.ts" />

import type { ESLint, Linter } from "eslint";
import { globalIgnores } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactCompiler from "eslint-plugin-react-compiler";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unicorn from "eslint-plugin-unicorn";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

import { localPlugin } from "../tools/eslint-rules/index.ts";

const reactHooksPlugin = reactHooks as unknown as ESLint.Plugin;

export const coreConfig: Linter.Config[] = [
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    // Any alternate Next dist dir (NEXT_DIST_DIR — e2e, sweep, ad-hoc source
    // runs) is a build artifact, never lintable source.
    "**/.next*/**",
    // Codex/agent-council runtime artifacts are machine-local tools, not repo
    // source; linting them would make local assistant state a product gate.
    ".agents/**",
    "**/coverage/**",
    "**/.turbo/**",
    // Playwright's HTML report ships minified vendor bundles; linting a
    // generated artifact dir gates the repo on third-party build output.
    "**/playwright-report/**",
    "**/prisma/generated/**",
    "openspec/**",
    // Workflow-harness scripts (the `Workflow` tool wraps these in an async
    // function and injects args/log/parallel/agent), so they legitimately use
    // top-level return/await and are not standalone modules — linting them as
    // such only produces false "return outside of function" parse errors.
    "**/*.workflow.mjs",
  ]),
  // A disable directive that no longer suppresses anything asserts a constraint
  // the code already satisfies. ESLint reports these at `warn` by default, which
  // is a severity `pnpm lint` does not gate on — so every one would accumulate.
  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      react,
      "jsx-a11y": jsxA11y,
      "react-hooks": reactHooksPlugin,
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
            "tools/*.ts",
            "eslint-config/*.ts",
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
      // simple-import-sort: deterministic import/export order (autofixable).
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      // unicorn — a CURATED allowlist, not the recommended preset.
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
      // conflicting hex-digit case.
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
      // Deliberate severity choices:
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unused-vars": "off", // delegated to unused-imports
      "unused-imports/no-unused-vars": [
        "error",
        {
          ignoreRestSiblings: true,
          // Leading underscore marks intentionally unused vars/args
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "unused-imports/no-unused-imports": "error",

      // React rules enforced at error.
      "react/jsx-no-useless-fragment": "error",
      "react/no-array-index-key": "error",
      "react/no-danger": "error",

      // jsx-a11y accessibility rules (recommended preset).
      ...jsxA11y.configs.recommended.rules,
      "jsx-a11y/no-noninteractive-tabindex": [
        "error",
        { roles: ["group", "region"] },
      ],
      // no-noninteractive-element-interactions: enabled by the recommended
      // preset, turned off here.
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      // label-has-associated-control: off. The codebase uses the wrapping-label
      // pattern (a <label> wrapping its input plus a sibling span), which this
      // rule wrongly rejects — a false positive, not a real a11y gap.
      "jsx-a11y/label-has-associated-control": "off",

      // Immutability regime (functional/immutable-by-default standard): prefer-const
      // forbids a never-reassigned `let`, no-var bans function-scoped `var`, and
      // no-param-reassign forbids parameter rebinding. The `let` ban itself
      // (no-restricted-syntax, with per-site justified survivors) lives in its own
      // source-scoped block below.
      "prefer-const": "error",
      "no-var": "error",
      "no-param-reassign": ["error", { props: false }],

      // ESLint core rules
      "prefer-rest-params": "error",
      "prefer-template": "error",
      "no-template-curly-in-string": "error",
      "no-unused-private-class-members": "error",

      // Type-aware rules
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/prefer-optional-chain": "error",

      // Syntactic / proven-noop type-aware rules (safe autofix).
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
      "@typescript-eslint/no-redundant-type-constituents": "error",
      "@typescript-eslint/no-duplicate-type-constituents": "error",
      "@typescript-eslint/no-unnecessary-type-parameters": "error",
      "@typescript-eslint/prefer-string-starts-ends-with": "error",
      "@typescript-eslint/no-useless-default-assignment": "error",

      // Type-aware rules whose fixes are noop/local, plus return-await, whose
      // fix is a genuine correctness gain (await inside try so the catch
      // observes async rejections).
      "@typescript-eslint/no-unnecessary-type-conversion": "error",
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",
      "@typescript-eslint/return-await": "error",

      "@typescript-eslint/no-deprecated": "error",

      // require-await repo-wide
      // (the declared standard does NOT exempt tests for the type-aware base).
      // src violations are fixed in code; test-mock methods that are async purely
      // to satisfy an async interface contract carry a per-site disable.
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-empty-function": "error",
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
      // no-misused-promises: every firing is a real correctness question
      // (a Promise used where a void/boolean is expected). Fixed per-site to
      // preserve intended behavior; no eslint-disable escape is permitted here.
      "@typescript-eslint/no-misused-promises": "error",
      // strictTypeChecked
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
      // unbound-method: product code carries no firings. Tests swap this for
      // `vitest/unbound-method` (see the test-file override), which models
      // `expect(mock.method)` natively instead of needing a disable per spy
      // assertion. The one genuine method-capture (reminders.scheduler.test)
      // was fixed with `.bind`, not a disable.
      "@typescript-eslint/unbound-method": "error",
      // no-base-to-string: 7 real "[object Object]" risks on `unknown` operands
      // (SAML profile fields, generic data-table cells, a spawn error's stderr),
      // each fixed by narrowing to a string at the source — no disables.
      "@typescript-eslint/no-base-to-string": "error",
      // no-confusing-void-expression: SOFTENED via `ignoreArrowShorthand: true`
      // (a deliberate relaxation from strictTypeChecked's default, documented as
      // such). 270 of 274 firings are arrow-shorthand void returns — idiomatic
      // React event handlers (`onClick={() => setOpen(true)}`) where the void
      // return is intended, not confusing. This softening opens NO Promise hole:
      // the only dangerous arrow-shorthand-void case is a Promise-returning call
      // in a void slot, and `no-misused-promises` (already error, with the
      // default checksVoidReturn) already rejects that. The 4 remaining real
      // firings — explicit `return <void-call>()` from block-bodied functions in
      // main.ts and sidebar.tsx — were fixed by hand (statement + bare `return`).
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true },
      ],
      // The `any`-flow
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
      // non-nullable-type-assertion-style: 9 firings, all `x as T` where T is the
      // non-null form of x (i.e. equivalent to `x!`). NOT converted to `!` (that
      // would seed the declared no-non-null-assertion→error target with new debt);
      // instead each was removed at the ROOT so no assertion is needed: the 3 src
      // `d.productId as string` sites turned their upstream `.filter(d => !!d.productId)`
      // into a type-predicate filter (`d is typeof d & { productId: string }`),
      // narrowing productId to string honestly; the test sites dropped the
      // assertion (non-optional tuple element / `map.get(k) ?? null`). 0 disables.
      "@typescript-eslint/non-nullable-type-assertion-style": "error",
      // no-unnecessary-type-assertion: 134 firings (44 src / 90 test). The
      // autofix removed the genuinely-redundant assertions across 40 files
      // cleanly (verified by tsc). The 8 remaining files carry a file-level
      // single-rule disable, NOT a removal: they hit a documented ESLint-vs-
      // tsc mismatch where ESLint's type-aware program judges an assertion
      // redundant but the app tsconfig still needs it — 8 RTL test files cast
      // `getByLabelText(...)` to a concrete element (HTMLInputElement etc.) to
      // reach .value/.checked/.options (TS2339 without it). File-level
      // (not line) disables here are position-independent — immune to the
      // pre-commit-prettier comment-shift hazard.
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      // The last
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
      // suite caught two optimistic-contract lies (a `ci` field, synthetic-ctx
      // `req.headers`) that typecheck could not — both now guarded + disabled.
      "@typescript-eslint/no-unnecessary-condition": "error",

      // React hooks (single-owned by ESLint)
      // no-magic-numbers: every non-trivial numeric literal must be a named
      // `const` (enforceConst). The options scope the rule to its signal:
      // -1/0/1/2 are universal idioms; array indexes, enums, readonly class
      // props, type positions and numeric literal types are self-documenting.
      // No autofix exists — firings are fixed by hand-lifting the literal,
      // never by mass-disable.
      "@typescript-eslint/no-magic-numbers": [
        "error",
        {
          ignore: [-1, 0, 1, 2],
          enforceConst: true,
          ignoreArrayIndexes: true,
          ignoreEnums: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
          ignoreNumericLiteralTypes: true,
        },
      ],

      // Full v7 recommended preset: the classic two rules plus the
      // React-Compiler-powered diagnostics (purity, set-state-in-effect,
      // immutability, refs, …) that pair with react-compiler/react-compiler.
      ...reactHooks.configs.recommended.rules,
      "react-hooks/exhaustive-deps": "error",
      // refs: error since the burn-down. The compiler taints a WHOLE hook
      // return object that bundles refs with data, so dialog components
      // DESTRUCTURE the hook result instead of holding the bag; the surviving
      // deliberate render-time ref patterns (latest-ref bridges, mutation
      // callbacks) carry per-site disables with reasons.
      "react-hooks/refs": "error",
      // set-state-in-effect: error since the 24-site burn-down (derive/paired
      // state/mount-fresh redesigns; the surviving effect-owned sites —
      // external-system syncs, signal props, timer choreography — carry
      // per-site disables with reasons).
      "react-hooks/set-state-in-effect": "error",

      // React Compiler (React 19)
      "react-compiler/react-compiler": "error",

      // file size + cyclomatic complexity. `max-lines` counts real code lines
      // only (skipBlankLines + skipComments); `complexity` uses the ESLint
      // default of 20 (community best-practice — 10 would be ~87 functions of
      // churn per the directive's "no overhead"; cognitive-complexity is
      // sonarjs's job). The rule is ACTIVE repo-wide so any NEW 301+ line file
      // or 20+ complexity function fails immediately. Pre-existing violators are
      // grandfathered in the permanent-exempt override blocks at the end of this
      // config.
      "max-lines": [
        "error",
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["error", 20],
    },
  },
  // `prisma/` has no tsconfig of its own, so projectService would parse it under
  // the config-less default project, where `node:*` resolves to `any` and every
  // seed helper trips no-unsafe-*. Use the project `lint:prisma:typecheck` uses.
  {
    files: ["prisma/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: ["./tsconfig.prisma.json"],
      },
    },
  },
  // Comment archaeology (change-log / ticket / phase refs) is banned by
  // AGENTS.md; git history holds that. Scoped to product source only —
  // `scripts/`, `tools/` and root configs legitimately carry plan-shaped labels.
  {
    files: [
      "apps/**/*.{ts,tsx,js,jsx,mjs}",
      "packages/**/*.{ts,tsx,js,jsx,mjs}",
      "prisma/**/*.{ts,tsx,js,jsx,mjs}",
      "e2e/**/*.{ts,tsx,js,jsx,mjs}",
    ],
    plugins: { local: localPlugin },
    rules: { "local/no-comment-archaeology": "error" },
  },
  // `scripts/` and `tools/` have the same shape as `prisma/`: no tsconfig the
  // project service can discover, so their `node:*` imports would resolve to
  // `any`. Point them at the project that typechecks these entrypoints.
  {
    files: ["scripts/**/*.ts", "tools/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: ["./tsconfig.scripts.json"],
      },
    },
  },
];
