import { defineConfig, globalIgnores } from "eslint/config";
import reactCompiler from "eslint-plugin-react-compiler";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

// RESIDUAL ESLint config (migrate-to-biome): Biome now owns formatting and the
// strict-preset lint rules (no-explicit-any, no-unused-vars, no-non-null-
// assertion) plus the AI no-restricted-imports Prisma-isolation rule. This file
// retains ONLY the rules with no stable Biome equivalent:
//   - react-compiler/react-compiler (no Biome equivalent; React 19 correctness)
//   - react-hooks/rules-of-hooks + exhaustive-deps (Biome hook parity not
//     guaranteed; ESLint must run anyway)
//   - @typescript-eslint/no-floating-promises (type-aware; Biome's equivalent is
//     nursery/experimental — keep the hard-error guarantee here)
//   - the AI no-restricted-syntax logger-secrets selector (no Biome rule;
//     protects the ai-module-facade / PITFALLS C-3 secret-logging guard)
export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/.next/**",
    // Phase 39-06: Playwright visual project uses a distinct distDir
    // (.next-e2e) so it can coexist with the user's `pnpm dev` instance.
    // The folder is generated, not authored, and its TS type-validators
    // aren't in any tsconfig project — must be ignored explicitly because
    // the `**/.next/**` glob doesn't match the suffixed name.
    "**/.next-e2e/**",
    "**/coverage/**",
    "**/.turbo/**",
    "**/prisma/generated/**",
    // Phase 35-08: prisma/seed*.ts run via `tsx` and aren't part of
    // any tsconfig project graph, so eslint's `projectService`
    // can't parse them. Excluded so lint-staged doesn't choke on
    // every seed-touching commit; the scripts validate at run time.
    "prisma/seed.ts",
    "prisma/seed-simple.ts",
    "prisma/seed-constants.ts",
    "**/e2e/**",
  ]),
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      // Registers the @typescript-eslint plugin (provides
      // no-floating-promises) and parser; supplied by the typescript-eslint
      // meta-package so the standalone @typescript-eslint/* deps aren't needed.
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooks,
      "react-compiler": reactCompiler,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // Type-aware lint machinery is required for no-floating-promises.
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
      // Type-aware; intentionally NOT delegated to Biome's nursery
      // noFloatingPromises so the hard-error guarantee never weakens.
      "@typescript-eslint/no-floating-promises": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-compiler/react-compiler": "error",
    },
  },
  // Phase 31 (AI-SPEC §5.2 / PITFALLS C-3): the AI no-restricted-imports
  // Prisma-isolation rule now lives in biome.json (noRestrictedImports). This
  // residual selector keeps the logger-secrets guard, which has no Biome rule.
  // Ban logging of named identifiers `prompt`, `messages`, `response` when
  // passed to a `logger.*` call. Narrow AST selector to ai/** files only —
  // unrelated modules retain freedom. Facade/test/fixture files are exempt.
  {
    files: ["apps/api/src/modules/ai/**/*.ts"],
    ignores: [
      "apps/api/src/modules/ai/ai-facade.ts",
      "apps/api/src/modules/ai/ai-cache.ts",
      "apps/api/src/modules/ai/ai-authz.ts",
      "apps/api/src/modules/ai/__tests__/**",
      "apps/api/src/modules/ai/__fixtures__/**",
      "apps/api/src/modules/ai/*.test.ts",
      "apps/api/src/modules/ai/*.spec.ts",
      "apps/api/src/modules/ai/*.eval.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='logger'] Identifier[name=/^(prompt|messages|response)$/]",
          message:
            "AI module: never log prompts/messages/response content (PITFALLS C-3).",
        },
      ],
    },
  },
]);
