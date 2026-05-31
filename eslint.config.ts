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
      "react/jsx-no-useless-fragment": "warn",
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
      "@typescript-eslint/dot-notation": "warn",
      "@typescript-eslint/prefer-optional-chain": "warn",

      // React hooks (single-owned by ESLint)
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // React Compiler (React 19, no Biome equivalent)
      "react-compiler/react-compiler": "error",
    },
  },
  // Test-file override: disable jsx-a11y (mirror biome.json a11y:off on tests)
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
