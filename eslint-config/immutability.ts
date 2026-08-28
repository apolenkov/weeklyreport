import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import type { ESLint, Linter } from "eslint";
import functional from "eslint-plugin-functional";

const eslintCommentsPlugin = eslintComments as unknown as ESLint.Plugin;
const functionalPlugin = functional as unknown as ESLint.Plugin;
const TEST_CONTOUR_IGNORES = [
  "**/*.test.{ts,tsx}",
  "**/*.spec.{ts,tsx}",
  "**/__tests__/**",
  "**/test-utils/**",
  "**/__fixtures__/**",
  "**/fixture/**",
  "**/fixtures/**",
  "**/*-harness.{ts,tsx}",
  "**/*.fixture.{ts,tsx}",
  "**/*.fixtures.{ts,tsx}",
  "**/*-fixture.{ts,tsx}",
  "**/*-test-fixture.{ts,tsx}",
] as const;

export const immutabilityConfig: Linter.Config[] = [
  // ── Immutability regime: `let` ban for production source. ──
  // A load-bearing mutable binding — a loop counter, a lazy singleton, a running
  // accumulator a functional rewrite would only obscure — keeps its `let` behind
  // an inline
  // `// eslint-disable-next-line no-restricted-syntax -- <why>`. Tests, seeds and
  // test scenarios stay imperative and are excluded.
  {
    files: [
      "apps/api/src/**/*.{ts,tsx}",
      "apps/web/src/**/*.{ts,tsx}",
      "packages/shared/src/**/*.{ts,tsx}",
      "packages/ui/src/**/*.{ts,tsx}",
    ],
    ignores: [...TEST_CONTOUR_IGNORES],
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
  // ── Prop-seam guard for report-pages/ui. ──
  // Components take a declared data slice, never a whole hook's return type, so
  // the seam stays readable and the hook can be refactored independently. Flat
  // config REPLACES rule options, so the `let` ban above is repeated verbatim.
  {
    files: ["apps/web/src/features/report-pages/ui/**/*.{ts,tsx}"],
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
        {
          selector:
            "TSTypeReference[typeName.name='ReturnType'] TSTypeQuery[exprName.name=/^use/]",
          message:
            "Prop-seam guard: declare the data slice this component needs instead of `ReturnType<typeof useX>`.",
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
  // UI, Prisma builders and React refs keep their local mutation idioms.
  {
    files: [
      "apps/api/src/modules/**/domain/**/*.ts",
      "packages/shared/src/**/*.ts",
    ],
    ignores: [...TEST_CONTOUR_IGNORES],
    plugins: { functional: functionalPlugin },
    rules: {
      "functional/immutable-data": [
        "error",
        { ignoreClasses: true, ignoreImmediateMutation: true },
      ],
    },
  },
  // Point-free ratchet, api modules only. The rule is arity-aware (verified: it
  // does NOT report `xs.map((x) => f(x))` when `f` has a second optional
  // parameter), so a tacit rewrite here cannot leak `map`'s index argument.
  // Scoped deliberately: outside this boundary the rule's suggestion strips the
  // type predicate from `(x): x is string => Boolean(x)`, which breaks narrowing
  // (measured: 2 typecheck errors across web + trpc infrastructure).
  // `checkMemberExpressions` stays default-off — it would add the `this`-binding
  // hazard of `.map(obj.method)`.
  {
    files: ["apps/api/src/modules/**/*.ts"],
    ignores: [...TEST_CONTOUR_IGNORES],
    plugins: { functional: functionalPlugin },
    rules: { "functional/prefer-tacit": "error" },
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
];
