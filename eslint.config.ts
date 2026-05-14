import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactCompiler from "eslint-plugin-react-compiler";

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
    // A38: tools/uat-extractor/*.ts run via `tsx` and aren't part of
    // any tsconfig project — same pattern as prisma/seed*.ts above.
    "tools/uat-extractor/*.ts",
    "**/e2e/**",
  ]),
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [tseslint.configs.strict],
    plugins: {
      "react-hooks": reactHooks,
      "react-compiler": reactCompiler,
    },
    languageOptions: {
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
          ],
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 32,
        },
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-extraneous-class": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-compiler/react-compiler": "error",
    },
  },
  // Phase 31 (AI-SPEC §5.2 / PITFALLS C-3): module-isolation rules for
  // the AI module. Raw @prisma/client imports are restricted to the
  // facade boundary (ai-facade.ts, ai-cache.ts, ai-authz.ts) only; every
  // other ai/** file must access DB through the facade.
  // ai-authz.ts is an authorization helper that needs Prisma directly
  // to evaluate visibility joins (M-02 / Phase 32-A3).
  // Test files and fixtures are also exempt because they construct
  // facade fakes that need the AiInsightKind enum type.
  {
    files: ["apps/api/src/modules/ai/**/*.ts"],
    ignores: [
      "apps/api/src/modules/ai/ai-facade.ts",
      "apps/api/src/modules/ai/ai-cache.ts",
      "apps/api/src/modules/ai/ai-authz.ts",
      "apps/api/src/modules/ai/__tests__/**",
      "apps/api/src/modules/ai/__fixtures__/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message:
                "AI module: import Prisma only via ai-facade.ts (CC-3 / module isolation per AI-SPEC §5.2).",
            },
          ],
        },
      ],
      // Ban logging of named identifiers `prompt`, `messages`, `response`
      // when passed to a `logger.*` call. Narrow AST selector to
      // ai/** files only — unrelated modules retain freedom.
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
