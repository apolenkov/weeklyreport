import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import type { ESLint, Linter } from "eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import functional from "eslint-plugin-functional";
import importX from "eslint-plugin-import-x";
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

// Max-strictness lint regime. ESLint owns logic, Prettier owns format,
// stylelint owns CSS. The durable standard lives in the openspec capability
// `lint-max-strictness-standard` (the single source of truth); this file is
// its enforcement. Each rule below carries its own rationale; permanent
// exemptions live in the override blocks at the end.
//
// @typescript-eslint rules are enabled individually (not via the recommended
// array, which would pull in rules the regime deliberately omits), alongside
// eslint-plugin-react, jsx-a11y (a pragmatic parity preset — net-new noise is
// turned off inline below), unused-imports, simple-import-sort, sonarjs,
// unicorn (a curated allowlist), jsdoc (published packages only), the
// max-lines + complexity budgets, and the import-boundary zones.
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

// ── Directory-architecture import boundaries (restructure-directory-architecture,
// slice 1). Two mechanisms: relative-path zones via import-x/no-restricted-paths
// (api cross-module, web cross-slice), package-name zones via
// no-restricted-imports (api domain purity, ui domain-free). Each ships RATCHETED
// — current violations grandfathered in a per-consumer allowlist that shrinks
// monotonically; a NEW cross-boundary import errors immediately. eslint-disable of
// these rules is banned below (@eslint-community/eslint-comments/no-restricted-disable)
// so the config allowlist is the ONLY grandfathering path.
const eslintCommentsPlugin = eslintComments as unknown as ESLint.Plugin;
const functionalPlugin = functional as unknown as ESLint.Plugin;

const apiModulesDir = "apps/api/src/modules";
const apiModules = [
  "activity",
  "admin",
  "analytics",
  "archive",
  "auth",
  "carry-over",
  "email",
  "observability",
  "organization",
  "pdf-export",
  "period",
  "project-activity",
  "publication",
  "reminders",
  "report-sections",
  "review",
  "search",
  "telegram",
  "telemetry",
  "weekly-report",
] as const;

// Loose cross-module files that still live at modules/ ROOT rather than inside a
// module — published-report-snapshot.ts and report-escalations.ts. Until they
// relocate into an owning module (a later slice), the modules that import them
// keep a path exception here, keyed by CONSUMING module. This is the ONLY
// path-based cross-module exception left: every module→module edge now goes
// through a sibling index.ts facade barrel (generated below), and any deep
// internal path errors. (published-report-snapshot.ts itself imports
// report-sections, but it is not under modules/M/** so no zone targets it.)
const apiCrossModuleLooseFiles: Record<string, readonly string[]> = {
  archive: ["published-report-snapshot.ts"],
  "pdf-export": ["published-report-snapshot.ts"],
  period: ["published-report-snapshot.ts"],
  publication: ["published-report-snapshot.ts"],
  "weekly-report": ["published-report-snapshot.ts", "report-escalations.ts"],
};

// One zone per module: files under modules/M may import from modules/ ONLY within
// their own module (except: [M]), through a sibling's index.ts facade barrel, or
// via a still-loose root file the module already depends on. Any other sibling
// internal path errors. The barrel allowlist is GENERATED (every sibling's
// index.ts), so a new module→module edge is legal the moment it targets the
// facade — no per-edge grandfathering to maintain.
const apiCrossModuleZones = apiModules.map((moduleName) => ({
  target: `${apiModulesDir}/${moduleName}`,
  from: apiModulesDir,
  except: [
    moduleName,
    ...apiModules
      .filter((sibling) => sibling !== moduleName)
      .map((sibling) => `${sibling}/index.ts`),
    ...(apiCrossModuleLooseFiles[moduleName] ?? []),
  ],
  message: `api module boundary: '${moduleName}' may reach a sibling module only through its index.ts facade barrel, never an internal path (restructure-directory-architecture).`,
}));

// One zone per web slice: files under features/S may import from features/ only
// within their own slice, plus the grandfathered cross-slice edges below. ALL
// populated slices are enforced (boundaries flip #33); any NEW slice-to-slice
// coupling not in the allowlist is a lint error.
const webFeaturesDir = "apps/web/src/features";
const webSlices = [
  "admin",
  "analytics",
  "dashboard",
  "landing",
  "organization",
  "pdf-export",
  "period",
  "report-sections",
  "review",
  "slides",
  "telemetry",
  "viewer",
] as const;
// Grandfathered cross-slice edges: pre-existing couplings between slices that
// the boundary rule allows explicitly — forbid a slice reaching into a NEW
// sibling, grandfather the pairs it already touches. `except` is slice-granular,
// so an entry permits any import between that pair — finer per-file enforcement
// is a separate mechanism, out of scope.
const webSliceGrandfatheredExcept: Partial<
  Record<(typeof webSlices)[number], readonly string[]>
> = {
  // admin settings tabs reach organization (reporting-group forms), period
  // (report-period forms), and review (reminder/verdict presentation).
  admin: ["organization", "period", "review"],
  // dashboard-page consumes review's section-review-rows + SectionReviewStrip;
  // its own mappers read report-sections' lead-status + traffic-light.
  dashboard: ["review", "report-sections"],
  // period lifecycle controls reach admin (settings context) and report-sections
  // (the assembled-report body they gate publish/reopen on).
  period: ["admin", "report-sections"],
  // report-sections is the assembled-report hub: it composes admin, pdf-export,
  // period, review, and slides surfaces into the rendered report.
  "report-sections": ["admin", "pdf-export", "period", "review", "slides"],
  // review surfaces sit on top of admin context and the report-sections body.
  review: ["admin", "report-sections"],
  // the slide deck reads report-sections' cross-author mappers + stage helpers to
  // build its grid model.
  slides: ["report-sections"],
  // the viewer report shell reuses pdf-export, period, report-sections, and the
  // slide deck UI.
  viewer: ["pdf-export", "period", "report-sections", "slides"],
};
const webCrossSliceZones = webSlices.map((sliceName) => ({
  target: `${webFeaturesDir}/${sliceName}`,
  from: webFeaturesDir,
  except: [sliceName, ...(webSliceGrandfatheredExcept[sliceName] ?? [])],
  message: `web slice boundary: '${sliceName}' may not import another slice's internals (restructure-directory-architecture).`,
}));

export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    // Any alternate Next dist dir (NEXT_DIST_DIR — e2e, sweep, ad-hoc source
    // runs) is a build artifact, never lintable source.
    "**/.next*/**",
    // Agent worktrees are full repo copies; linting them triples the file set
    // and OOMs eslint. Each worktree lints itself.
    ".claude/worktrees/**",
    // Codex/agent-council runtime artifacts are machine-local tools, not repo
    // source; linting them would make local assistant state a product gate.
    ".agents/**",
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
      "@typescript-eslint/no-non-null-assertion": "warn",
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
      "unused-imports/no-unused-imports": "warn",

      // React rules enforced at error.
      "react/jsx-no-useless-fragment": "error",
      "react/no-array-index-key": "error",
      "react/no-danger": "error",

      // jsx-a11y accessibility rules (recommended preset).
      ...jsxA11y.configs.recommended.rules,
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

      // ESLint core rules (warn = won't gate)
      "prefer-rest-params": "error",
      "prefer-template": "warn",
      "no-template-curly-in-string": "warn",
      "no-unused-private-class-members": "warn",

      // Type-aware rules
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/prefer-optional-chain": "warn",

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

      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // React Compiler (React 19)
      "react-compiler/react-compiler": "error",

      // file size + cyclomatic complexity. `max-lines` counts real code lines
      // only (skipBlankLines + skipComments); `complexity` uses the ESLint
      // default of 20 (community best-practice — 10 would be ~87 functions of
      // churn per the directive's "no overhead"; cognitive-complexity is
      // sonarjs's job). The rule is ACTIVE repo-wide so any NEW 250+ line file
      // or 20+ complexity function fails immediately. Pre-existing violators are
      // grandfathered in the permanent-exempt override blocks at the end of this
      // config.
      "max-lines": [
        "error",
        { max: 250, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["error", 20],
    },
  },
  // sonarjs (community recommended preset). Per the user directive
  // (community-strict, no overhead, default presets win), the full recommended
  // ruleset is enabled — every rule that fires ZERO times is enforced going
  // forward (regression prevention). Rules that fire today split into two
  // buckets: PRUNE (permanently off — noise/duplicate/convention-conflict) and
  // the rest, enforced at error after each firing was fixed or per-site
  // disabled with a reason.
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
      // — ENFORCED AT ERROR (with a reason where a firing survives) —
      // Behavior-sensitive hotspots (cognitive-complexity, no-nested-functions)
      // are cohesive single concerns where splitting below the threshold
      // fragments logic or breaks memoization; those files carry a permanent
      // exempt in the override blocks below rather than a rewrite. New code
      // stays gated.
      "sonarjs/cognitive-complexity": "error",
      "sonarjs/no-nested-functions": "error",
      // enforced in src (regression prevention); the only
      // current firings are fake fixtures (10.0.0.x IPs, fake passwords) in
      // test files, scoped off in the test-file override below.
      "sonarjs/no-hardcoded-ip": "error",
      "sonarjs/hardcoded-secret-signatures": "error",
      // The following are enforced at error. Behavior-sensitive rules (slow-
      // regex, no-alphabetical-sort, pseudo-random) are per-site-disabled with
      // reasons, NOT rewritten. Several also need a test-file carve-out (below)
      // where the firing is inherent to test code.
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
      // verified via the TS language server — `i.id`
      // (string | undefined) vs `record.sourceId` (string | null) overlap on
      // `string`, so the comparison is meaningful (match by id); the null/
      // undefined asymmetry is harmless. 2 sites per-site-disabled in
      // carry-over.service. NOT an always-false bug.
      "sonarjs/different-types-comparison": "error",
      // no-duplicate-string: the recommended preset ships this OFF; enabled
      // here so a string literal repeated 3+ times must be lifted to a shared
      // named constant. Tests are carved out below (repeated fixture strings
      // are inherent to test code).
      "sonarjs/no-duplicate-string": "error",
    },
  },
  // jsdoc — TS-flavored recommended, scoped to the two published packages'
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
  // import boundary — apps/web must not import apps/api at RUNTIME. The tRPC
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
  // ── restructure-directory-architecture slice 1: import-boundary zones. ──
  // Resolver so import-x/no-restricted-paths can map relative NodeNext specifiers
  // (`../period/period-transition.js` → the real .ts) to real paths; without it the
  // rule silently matches nothing and every zone becomes an inert no-op.
  {
    settings: {
      "import-x/resolver-next": [
        createTypeScriptImportResolver({
          noWarnOnMultipleProjects: true,
          project: [
            "apps/api/tsconfig.json",
            "apps/web/tsconfig.json",
            "packages/shared/tsconfig.json",
            "packages/ui/tsconfig.json",
          ],
        }),
      ],
    },
  },
  // Zone 3 — api cross-module internals. Tests are exempt: cross-module imports in
  // test setup are wiring, not production coupling (12 test files do it today).
  {
    files: ["apps/api/src/**/*.ts"],
    ignores: ["**/*.test.ts", "**/*.spec.ts", "**/__tests__/**"],
    plugins: { "import-x": importX },
    rules: {
      "import-x/no-restricted-paths": ["error", { zones: apiCrossModuleZones }],
    },
  },
  // Zone 5 — web cross-slice ban. Each extracted web slice appends its own zone
  // `{ target: features/<slice>, from: features, except: [<slice>] }` to
  // webCrossSliceZones — a shared allowlist cannot distinguish self-import from
  // cross-slice, so zones stay per-slice.
  {
    files: ["apps/web/src/features/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/__tests__/**"],
    plugins: { "import-x": importX },
    rules: {
      "import-x/no-restricted-paths": ["error", { zones: webCrossSliceZones }],
    },
  },
  // Zone 4 — api domain purity (package-name zone). Files under an invariant
  // module's domain/ must not import an adapter dependency AT ALL — value OR
  // type — so the governing law of the module hexagon holds: delete Nest/Prisma
  // and the pure domain still compiles. A file that types against a Prisma
  // TransactionClient/entity slice is a transaction applicator (an application
  // use-case), not domain — it lives in application/ and receives the client
  // through a port.
  {
    files: [
      "apps/api/src/modules/period/domain/**/*.ts",
      "apps/api/src/modules/report-sections/domain/**/*.ts",
      "apps/api/src/modules/review/domain/**/*.ts",
      "apps/api/src/modules/publication/domain/**/*.ts",
      // admin is a flat (non-hexagon) module; its port file joins the ban so
      // the fixed ReportStatus leak cannot regress (report-status-type).
      "apps/api/src/modules/admin/admin-shared.ts",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@prisma/client",
                "@nestjs/*",
                "ioredis",
                "bullmq",
                "nodemailer",
              ],
              message:
                "domain/ is pure: no @prisma/client, @nestjs/*, ioredis, bullmq or nodemailer (value OR type) — a Prisma-typed transaction applicator belongs in application/, receiving its client through a port (restructure-directory-architecture).",
            },
          ],
        },
      ],
    },
  },
  // Zone 4b — repository port-type boundary (repository-port-type-boundary
  // spec). The explicit inventory of port-declaring files: module
  // service/contract files whose interfaces domain code and routers consume.
  // They must not import @prisma/client — value OR type — so no port can leak
  // a Prisma type again (the admin-shared.ts leak fixed by report-status-type
  // is pinned by Zone 4 above). Unlike domain/, these files may use Nest —
  // only the Prisma boundary is banned. Sanctioned Prisma users stay OUTSIDE
  // this list: infrastructure/**, *.prisma-repository.ts adapters,
  // transaction applicators in application/, module query internals, and lib
  // helpers. A new port file joins this list in the change that creates it.
  {
    files: [
      "apps/api/src/modules/activity/activity.service.ts",
      "apps/api/src/modules/analytics/analytics.service.ts",
      "apps/api/src/modules/archive/archive.service.ts",
      "apps/api/src/modules/carry-over/carry-over.service.ts",
      "apps/api/src/modules/organization/organization.service.ts",
      "apps/api/src/modules/pdf-export/pdf-export.service.ts",
      "apps/api/src/modules/period/application/period.service.ts",
      "apps/api/src/modules/project-activity/project-activity.service.ts",
      "apps/api/src/modules/publication/application/publication.service.ts",
      "apps/api/src/modules/reminders/reminders.service.ts",
      "apps/api/src/modules/report-sections/application/report-sections.service.ts",
      "apps/api/src/modules/review/application/review-actions.service.ts",
      "apps/api/src/modules/review/application/review.service.ts",
      "apps/api/src/modules/search/search.service.ts",
      "apps/api/src/modules/telemetry/telemetry.gauges.ts",
      "apps/api/src/modules/telemetry/telemetry.service.ts",
      "apps/api/src/modules/weekly-report/weekly-report.service.ts",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@prisma/client"],
              message:
                "Port-contract files must not import @prisma/client (value OR type): return shared or locally owned read models — Prisma stays behind infrastructure adapters and sanctioned application/ applicators (repository-port-type-boundary).",
            },
          ],
        },
      ],
    },
  },
  // ── Immutability regime: `let` ban for production source. ──
  // A load-bearing mutable binding — a loop counter, a lazy singleton, a running
  // accumulator a functional rewrite would only obscure — keeps its `let` behind
  // an inline
  // `// eslint-disable-next-line no-restricted-syntax -- <why>`. Tests, seeds and
  // e2e stay imperative and are excluded.
  {
    files: [
      "apps/api/src/**/*.{ts,tsx}",
      "apps/web/src/**/*.{ts,tsx}",
      "packages/shared/src/**/*.{ts,tsx}",
      "packages/ui/src/**/*.{ts,tsx}",
    ],
    ignores: [
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "**/__tests__/**",
      "apps/*/src/test-utils/**",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "VariableDeclaration[kind='let']",
          message:
            "Immutability regime: prefer const. A load-bearing mutable binding may keep `let` behind an inline `eslint-disable-next-line no-restricted-syntax -- <why>`.",
        },
      ],
    },
  },
  // `no-param-reassign` is globally `props:false`; the session hydration
  // chokepoint is stricter because mutating a caller-owned UserSession can leak
  // authz scope across the request pipeline.
  {
    files: ["apps/api/src/infrastructure/trpc/trpc.session-hydration.ts"],
    rules: {
      "no-param-reassign": ["error", { props: true }],
    },
  },
  // Functional immutability ratchet: only pure source layers. Infrastructure,
  // UI, Prisma builders, React refs, and tests keep their local mutation idioms.
  {
    files: [
      "apps/api/src/modules/**/domain/**/*.ts",
      "packages/shared/src/**/*.ts",
    ],
    ignores: ["**/*.test.ts", "**/*.spec.ts", "**/__tests__/**"],
    plugins: { functional: functionalPlugin },
    rules: {
      "functional/immutable-data": [
        "error",
        { ignoreClasses: true, ignoreImmediateMutation: true },
      ],
    },
  },
  // Zone 6 — ui stays domain-free (package-name zone). packages/ui primitives must
  // not import @customreport/shared domain schemas; charts receive finished series
  // as props. Currently 0 violations.
  {
    files: ["packages/ui/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@customreport/shared", "@customreport/shared/*"],
              message:
                "packages/ui must stay domain-free: no @customreport/shared schemas; shape data in the web slice or api and pass finished series as props (restructure-directory-architecture).",
            },
          ],
        },
      ],
    },
  },
  // Suppression ban: eslint-disable of any boundary-zone rule is forbidden, so the
  // config-level allowlist is the ONLY grandfathering mechanism (every exemption
  // reviewable in one place, shrinking monotonically). A bare disable that would
  // sweep these rules is caught too.
  {
    plugins: { "@eslint-community/eslint-comments": eslintCommentsPlugin },
    rules: {
      "@eslint-community/eslint-comments/no-restricted-disable": [
        "error",
        "import-x/no-restricted-paths",
        "@typescript-eslint/no-restricted-imports",
      ],
    },
  },
  // Test-file override: disable jsx-a11y on tests and exempt size/complexity
  // budgets (tests routinely exceed them).
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
      // Test literals (fixture counts, expected values, dates) are the
      // assertion itself — naming each one adds noise, not meaning.
      "@typescript-eslint/no-magic-numbers": "off",
      // tests are exempt from complexity budgets (same as
      // the core `complexity`/`max-lines` above) — long arrange/act/assert
      // bodies and nested setup callbacks are idiomatic test structure.
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/no-nested-functions": "off",
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
  // Tooling files are not product source — exempt from size/complexity budgets
  // (eslint.config.ts itself is 400+ lines; *.config.ts / *.setup.ts likewise).
  {
    files: ["**/*.config.ts", "**/*.setup.ts", "tools/**"],
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
  // JUSTIFIED PERMANENT max-lines exemptions — data / generated / one-off
  // script / bootstrap, where splitting would not improve clarity (per
  // ~/.claude code-style: "if splitting would hurt clarity, keep the larger
  // unit and say why"). These are the documented end-state exempts, NOT TODO.
  {
    files: [
      "apps/web/src/shared/lib/dashboard-mock-data.ts", // fixture data, no logic
      "apps/web/src/features/report-sections/model/mock-data.ts", // fixture data, no logic
      "apps/web/src/shared/lib/admin-mock-data.ts", // fixture data, no logic
      "packages/ui/src/components/ui/sidebar.tsx", // shadcn/ui generated primitive bundle
      "prisma/wipe-manual-uat.ts", // one-off operational script (cf. seeds, ignored)
      "packages/shared/src/schemas/report.schema.ts", // dense Zod schema catalogue, no logic
      "apps/api/src/main.ts", // bootstrap; load-order documentation, not splittable
      // Long-tail (300-500): each is one cohesive concern where a split would
      // shed few lines at a clarity cost — exempt, not churn.
      "apps/api/src/infrastructure/trpc/trpc.middleware.ts", // tRPC instance + all procedure builders share the private `t` binding
      "apps/api/src/modules/admin/period-admin.service.ts", // one Admin period-lifecycle service class
      "apps/api/src/modules/report-sections/infrastructure/report-sections.prisma-repository.ts", // one Prisma persistence layer; include/type/mapper/class coupled
      "apps/web/src/features/admin/ui/products-tab.tsx", // one CRUD screen; private icon helpers only
      "apps/web/src/features/review/ui/risk-edit-dialog.tsx", // one dialog: state + validation + render
      "apps/web/src/features/report-sections/ui/item-edit-dialog.tsx", // one create/edit dialog; shell + content coupled
      "apps/web/src/features/period/ui/decision-edit-dialog.tsx", // one create/edit dialog; XOR parent picker + per-field validation + conditional stage step — parity with item/risk-edit-dialog (shared helpers already extracted)
      "apps/web/src/features/report-sections/ui/lead-form-sync-bridge.tsx", // one context bridge wiring sync to two consumers
      "apps/web/src/shared/ui/navigation/nav-bar.tsx", // one role-aware nav widget; MobileNav/coming-soon have no external consumers
      "apps/web/src/features/dashboard/ui/dashboard-page.tsx", // one head-dashboard page; private load-issue helper only
      "apps/web/src/features/report-sections/ui/product-accordion.tsx", // one accordion for one ProductReport
      "apps/web/src/features/report-sections/ui/weekly-report-page.tsx", // one page: data load + 3 mutations + render
      "apps/web/src/features/period/ui/current-week-section.tsx", // 255 lines: FSD relocation forced two model imports to multi-line (longer paths), tipping it 5 over; content unchanged from its <=250 pre-move form. Candidate for a small extraction.
      "apps/web/src/features/report-sections/model/lead-form.ts", // one LeadForm mapping pipeline; types-out alone stays >300, further split fragments it
      // God-files (700+), permanent-exempt: a namespace split is mechanically
      // possible but would not improve the file (per code-style: keep the larger
      // unit and say why).
      "apps/api/src/infrastructure/trpc/trpc.router.ts", // single tRPC god-router; all 17 namespace sub-routers close over one RouterDeps; real fix is service-layer extraction, not a shell split
      "apps/api/src/modules/report-sections/infrastructure/lead-form.prisma-repository.ts", // one DI provider for one LeadFormRepository interface; domain separation already lives at the service layer above it
      "apps/web/src/features/slides/model/section-slide-utils.ts", // core mapper buildSectionSlideModel (247 lines) + its private helpers are inseparable; extracting all else still leaves ~335 lines
    ],
    rules: { "max-lines": "off" },
  },
  // JUSTIFIED PERMANENT no-magic-numbers exemptions — files where the numbers
  // ARE the content: naming each one adds indirection without meaning. New
  // logic in other files stays gated.
  {
    files: [
      // Histogram-bucket catalogues: each number is a distribution boundary
      // chosen against the web-vitals / latency-SLO thresholds documented in
      // the adjacent jsdoc. Lifting them to consts is a rename, not a doc —
      // and the rule fires inside const arrays anyway (verified).
      "apps/api/src/infrastructure/metrics/web-vitals.metrics.ts",
      "apps/api/src/infrastructure/metrics/metrics.registry.ts",
      // One-off operational scripts (cf. the max-lines exempt for
      // wipe-manual-uat and the globally-ignored seeds).
      "prisma/reset-hard.ts",
      "prisma/wipe-manual-uat.ts",
      // Vendored shadcn/ui primitive bundle (generated upstream code; editing
      // it creates drift against the shadcn source).
      "packages/ui/src/components/ui/**",
      // Test infrastructure — same footing as the test-file override above.
      "apps/api/src/test-utils/**",
    ],
    rules: { "@typescript-eslint/no-magic-numbers": "off" },
  },
  // Fixture catalogues, vendored primitives and one-off ops scripts: repeated
  // literals ARE the data (product names, seed emails, generated class
  // strings) — same footing as the test carve-out above.
  {
    files: [
      "apps/web/src/shared/lib/dashboard-mock-data.ts",
      "apps/web/src/features/report-sections/model/mock-data.ts",
      "apps/web/src/shared/lib/admin-mock-data.ts",
      "packages/ui/src/components/ui/sidebar.tsx",
      "prisma/wipe-manual-uat.ts",
      "apps/web/uat-suite/**",
    ],
    rules: { "sonarjs/no-duplicate-string": "off" },
  },
  //
  // JUSTIFIED PERMANENT complexity exempts (cyclomatic > 20). Each file is a
  // cohesive single concern where splitting below the threshold fragments
  // logic, breaks memoization, or forces artificial slicing. Permanent (NOT a
  // TODO); `complexity: 20` still gates new code.
  {
    files: [
      "apps/web/src/app/(app)/reports/page.tsx", // role-aware history renderer; 5 roles × distinct query/filter/label paths
      "apps/web/src/features/admin/ui/admin-panel.tsx", // 9-tab dispatch + skeleton/loaded gating; only ~3 pts extractable
      "apps/web/src/features/period/ui/decision-edit-dialog.tsx", // one create/edit dialog; per-field validation + conditional fields
      "apps/web/src/features/report-sections/ui/item-edit-dialog.tsx", // one form dialog; interdependent state (text/status/product/priority/stages)
      "apps/web/src/features/period/ui/lead-history-sidebar.tsx", // status-card multi-branch messaging (streak/viewer/draft/risk)
      "apps/web/src/features/report-sections/ui/next-week-section.tsx", // kanban CRUD + discriminated-union dialog state + grouped columns
      "apps/web/src/features/review/ui/risk-edit-dialog.tsx", // one dialog; validation coupled to 7+ form fields; 'use no memo' race guard
      "apps/web/src/features/review/ui/risks-section.tsx", // 3 dialog states across handlers + JSX; prior split broke behavior
      "apps/web/src/features/report-sections/ui/stage-chip.tsx", // interactive chip; dropdown/status/clear/popover entangled via hooks
      "apps/web/src/shared/ui/navigation/nav-bar.tsx", // role-based link filtering + session/hydration across layout slots
      "apps/web/src/features/slides/model/section-slide-utils.ts", // 4 domain transforms; branch count inherent to the data they model
      "apps/web/src/features/report-sections/ui/product-accordion.tsx", // 6 status-aware sections; uniform accordion pattern
      "apps/web/src/features/report-sections/ui/weekly-report-page.tsx", // role-aware state machine: query status + publish + filter + grouping
    ],
    rules: { complexity: "off" },
  },
  // JUSTIFIED PERMANENT sonarjs/cognitive-complexity exempts. Same rationale
  // as the cyclomatic block above (many files overlap — the same cohesive
  // monoliths).
  {
    files: [
      "apps/api/src/infrastructure/trpc/trpc.middleware.ts", // start/finish request logging + error capture in one lifecycle closure
      "apps/api/src/infrastructure/trpc/trpc.router.ts", // wipeAndReseed dispatch + compiledHistory 5-loop accumulator
      "apps/api/src/modules/admin/period-admin.service.ts", // manual period edit + per-field audit diff (only layer with before+after)
      "apps/web/src/app/(app)/reports/page.tsx", // see cyclomatic block (same role-aware renderer)
      "apps/web/src/features/dashboard/ui/remind-lead-button.tsx", // one ConfirmState machine → label/message/icon/disabled
      "apps/web/src/features/period/ui/lead-history-sidebar.tsx", // see cyclomatic block
      "apps/web/src/features/review/ui/risks-section.tsx", // see cyclomatic block
      "apps/web/src/features/report-sections/ui/stage-chip.tsx", // see cyclomatic block
      "apps/web/src/features/slides/model/section-slide-utils.ts", // see cyclomatic block
      "apps/web/src/features/report-sections/ui/product-accordion.tsx", // see cyclomatic block
      "apps/web/uat-suite/inventory.mjs", // classify() must stay inline (runs inside page.evaluate) + multi-phase report IIFE
    ],
    rules: { "sonarjs/cognitive-complexity": "off" },
  },
  // JUSTIFIED PERMANENT sonarjs/no-nested-functions exempts. Nested callbacks
  // inside render/state-setter pipelines or browser-serialized scripts;
  // extracting fragments the concern or breaks memoization.
  {
    files: [
      "apps/web/src/features/landing/ui/tagline-cycler.tsx", // self-recursive setTimeout handler mutating timer/visible/index state
      "apps/web/src/hooks/use-status-risk.ts", // arrow callbacks in state-update chains; consolidated to avoid loops via syncSourceRef
      "apps/web/src/lib/trpc.ts", // RxJS observer/cleanup handlers in the error-link middleware
    ],
    rules: { "sonarjs/no-nested-functions": "off" },
  },
]);
