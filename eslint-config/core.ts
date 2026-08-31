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

const reactHooksPlugin = reactHooks as unknown as ESLint.Plugin;

export const coreConfig: Linter.Config[] = [
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    // Any alternate Next dist dir is a build artifact, never lintable source.
    "**/.next*/**",
    // Codex/agent-council runtime artifacts are machine-local tools, not repo
    // source; linting them would make local assistant state a product gate.
    ".agents/**",
    "**/coverage/**",
    "**/.turbo/**",
    "openspec/**",
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
      // Curated Unicorn rules only. The complete recommended preset conflicts
      // with typed DOM collections, explicit undefined values, and SVG namespaces.
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

      // Async interface mocks that need no await carry a reasoned per-site disable.
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-empty-function": "error",
      // allowWithDecorator exempts decorated classes: in this NestJS codebase
      // an empty `@Module` class is correct by design (the decorator carries
      // the provider/import metadata). This is the rule's built-in
      // framework-accommodation option; non-decorated empty classes still fail.
      "@typescript-eslint/no-extraneous-class": [
        "error",
        { allowWithDecorator: true },
      ],
      // Promise values must not leak into void or boolean positions.
      "@typescript-eslint/no-misused-promises": "error",
      // Numbers and booleans interpolate safely; unknown, nullish, never, and
      // RegExp values must be narrowed explicitly.
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
      // Empty strings intentionally fall through display-label defaults, while
      // number, boolean, and object defaults remain nullish-only.
      "@typescript-eslint/prefer-nullish-coalescing": [
        "error",
        { ignorePrimitives: { string: true } },
      ],
      // Tests use vitest/unbound-method so spy assertions retain mock semantics.
      "@typescript-eslint/unbound-method": "error",
      // Unknown values must be narrowed before stringification.
      "@typescript-eslint/no-base-to-string": "error",
      // Arrow-shorthand void expressions are idiomatic React handlers;
      // no-misused-promises still rejects Promise-returning handlers.
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true },
      ],
      // Keep the complete strict any-flow family enabled.
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      // Prefer real narrowing over assertion-based non-null claims.
      "@typescript-eslint/non-nullable-type-assertion-style": "error",
      // RTL element casts may carry a file-level disable where ESLint and the
      // package tsconfig disagree about concrete DOM element properties.
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      // Use `.at()` where out-of-bounds access is possible so runtime guards are
      // represented honestly in the type. Boundary type gaps need a reasoned
      // per-site disable.
      "@typescript-eslint/no-unnecessary-condition": "error",

      // React hooks (single-owned by ESLint)
      // no-magic-numbers: every non-trivial numeric literal must be a named
      // `const` (enforceConst). The options scope the rule to its signal:
      // -1/0/1/2 are universal idioms; array indexes, enums, readonly class
      // props, type positions and numeric literal types are self-documenting.
      // No autofix exists; lift each literal into a named constant rather than
      // mass-disabling the rule.
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
      // Destructure hooks that bundle refs with data; deliberate render-time ref
      // bridges carry a reasoned per-site disable.
      "react-hooks/refs": "error",
      // Effect-owned external sync and timer choreography require a reasoned
      // per-site disable.
      "react-hooks/set-state-in-effect": "error",

      // React Compiler (React 19)
      "react-compiler/react-compiler": "error",

      // file size + cyclomatic complexity. `max-lines` counts real code lines
      // only (skipBlankLines + skipComments); `complexity` uses the ESLint
      // default of 20; cognitive complexity is owned by sonarjs. Named override
      // blocks below document the files that use a different limit.
      "max-lines": [
        "error",
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["error", 20],
    },
  },
  // `prisma/` has no tsconfig of its own, so projectService would parse it under
  // the config-less default project, where `node:*` resolves to `any` and every
  // seed helper trips no-unsafe-*. Use the root typecheck command's Prisma project.
  {
    files: ["prisma/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: ["./tsconfig.prisma.json"],
      },
    },
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
