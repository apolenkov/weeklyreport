import type { Linter } from "eslint";

export const STRUCTURAL_RULE_IDS = [
  "max-lines",
  "max-lines-per-function",
  "complexity",
  "sonarjs/cognitive-complexity",
] as const;

export type StructuralRuleId = (typeof STRUCTURAL_RULE_IDS)[number];

export const STRUCTURAL_FILE_MAX = 230;
export const STRUCTURAL_FUNCTION_MAX = 57;
export const STRUCTURAL_CYCLOMATIC_MAX = 10;
export const STRUCTURAL_COGNITIVE_MAX = 9;

export const STRICT_STRUCTURAL_LIMITS = {
  "max-lines": STRUCTURAL_FILE_MAX,
  "max-lines-per-function": STRUCTURAL_FUNCTION_MAX,
  complexity: STRUCTURAL_CYCLOMATIC_MAX,
  "sonarjs/cognitive-complexity": STRUCTURAL_COGNITIVE_MAX,
} as const satisfies Readonly<Record<StructuralRuleId, number>>;

export const STRUCTURAL_RULE_CONFIG = {
  "max-lines": [
    "error",
    { max: STRUCTURAL_FILE_MAX, skipBlankLines: true, skipComments: true },
  ],
  "max-lines-per-function": [
    "error",
    {
      max: STRUCTURAL_FUNCTION_MAX,
      skipBlankLines: true,
      skipComments: true,
      IIFEs: true,
    },
  ],
  complexity: ["error", STRUCTURAL_CYCLOMATIC_MAX],
  "sonarjs/cognitive-complexity": ["error", STRUCTURAL_COGNITIVE_MAX],
} as const satisfies Linter.RulesRecord;

export const MAINTAINED_PRODUCT_STRUCTURAL_FILES = [
  "apps/api/src/**/*.{ts,tsx,js,jsx,mjs,cjs}",
  "apps/web/src/**/*.{ts,tsx,js,jsx,mjs,cjs}",
  "packages/shared/src/**/*.{ts,tsx,js,jsx,mjs,cjs}",
  "packages/ui/src/**/*.{ts,tsx,js,jsx,mjs,cjs}",
] as const;

export const SEPARATELY_MEASURED_STRUCTURAL_IGNORES = [
  "**/*.test.{ts,tsx,js,jsx,mjs,cjs}",
  "**/*.spec.{ts,tsx,js,jsx,mjs,cjs}",
  "**/__tests__/**",
  "**/test-utils/**",
  "**/__fixtures__/**",
  "**/fixture/**",
  "**/fixtures/**",
  "**/*.fixture.{ts,tsx,js,jsx,mjs,cjs}",
  "**/*.fixtures.{ts,tsx,js,jsx,mjs,cjs}",
  "**/*-fixture.{ts,tsx,js,jsx,mjs,cjs}",
  "**/*-test-fixture.{ts,tsx,js,jsx,mjs,cjs}",
  "**/generated/**",
  "**/*.generated.{ts,tsx,js,jsx,mjs,cjs}",
] as const;

export const exemplaryStructureConfig: Linter.Config = {
  files: [...MAINTAINED_PRODUCT_STRUCTURAL_FILES],
  ignores: [...SEPARATELY_MEASURED_STRUCTURAL_IGNORES],
  rules: STRUCTURAL_RULE_CONFIG,
};
