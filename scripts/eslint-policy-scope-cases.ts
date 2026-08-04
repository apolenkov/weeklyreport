export interface PlantedProbe {
  readonly id: string;
  readonly positive: string;
  readonly negative: string;
  readonly rule: string;
  readonly code: string;
  readonly positiveReports: boolean;
  readonly negativeReports: boolean;
}

const API_MAIN = "apps/api/src/main.ts";
const API_FENCE_TEST = "apps/api/src/app.module.fence.test.ts";
const SHARED_INDEX = "packages/shared/src/index.ts";
const REQUIRE_JSDOC = "jsdoc/require-jsdoc";
const WEB_LEAD_FORM = "apps/web/src/features/report-pages/ui/lead-form.tsx";
const WEB_LEAD_FORM_TEST =
  "apps/web/src/features/report-pages/ui/lead-form.test.tsx";
const WEB_TRPC = "apps/web/src/lib/trpc.ts";
const longSource = Array.from(
  { length: 305 },
  (_unused, index) => `export const line${index} = ${index};`,
).join("\n");
const functionAtBudget = `export function atBudget(): number {
${Array.from({ length: 67 }, (_unused, index) => `  const value${index} = ${index};`).join("\n")}
  return value66;
}`;
const functionOverBudget = `export function overBudget(): number {
${Array.from({ length: 68 }, (_unused, index) => `  const value${index} = ${index};`).join("\n")}
  return value67;
}`;
const complexSource = `export function classify(values) {
  if (values[0]) return 0;
  if (values[1]) return 1;
  if (values[2]) return 2;
  if (values[3]) return 3;
  if (values[4]) return 4;
  if (values[5]) return 5;
  if (values[6]) return 6;
  if (values[7]) return 7;
  if (values[8]) return 8;
  if (values[9]) return 9;
  if (values[10]) return 10;
  return 11;
}`;

export const plantedScopeProbes: readonly PlantedProbe[] = [
  {
    id: "typescript-language",
    positive: API_MAIN,
    negative: "apps/web/src/styles/app.css",
    rule: "@typescript-eslint/no-explicit-any",
    code: "export const value: any = 1;",
    positiveReports: true,
    negativeReports: false,
  },
  {
    id: "comment-policy",
    positive: API_MAIN,
    negative: "scripts/lint-gate.ts",
    rule: "local/no-comment-archaeology",
    code: "// Phase 99 cleanup.\nexport const value = 1;",
    positiveReports: true,
    negativeReports: false,
  },
  {
    id: "sonar-language",
    positive: API_MAIN,
    negative: "apps/web/src/styles/app.css",
    rule: "sonarjs/no-hardcoded-ip",
    code: "export const address = '10.20.30.40';",
    positiveReports: true,
    negativeReports: false,
  },
  {
    id: "package-public-api",
    positive: SHARED_INDEX,
    negative: API_MAIN,
    rule: REQUIRE_JSDOC,
    code: "export function undocumented(value: string): string { return value; }",
    positiveReports: true,
    negativeReports: false,
  },
  {
    id: "package-public-schema-constant",
    positive: SHARED_INDEX,
    negative: API_MAIN,
    rule: REQUIRE_JSDOC,
    code: "export const undocumentedSchema = 1;",
    positiveReports: true,
    negativeReports: false,
  },
  {
    id: "package-public-type",
    positive: SHARED_INDEX,
    negative: API_MAIN,
    rule: REQUIRE_JSDOC,
    code: "export type UndocumentedType = string;",
    positiveReports: true,
    negativeReports: false,
  },
  {
    id: "package-public-interface",
    positive: SHARED_INDEX,
    negative: API_MAIN,
    rule: REQUIRE_JSDOC,
    code: "export interface UndocumentedContract { readonly value: string; }",
    positiveReports: true,
    negativeReports: false,
  },
  {
    id: "package-detached-jsdoc",
    positive: SHARED_INDEX,
    negative: API_MAIN,
    rule: REQUIRE_JSDOC,
    code: "/** Documents only the private declaration. */\nconst internal = 1;\nexport const undocumented = internal;",
    positiveReports: true,
    negativeReports: false,
  },
  {
    id: "package-local-export-list",
    positive: SHARED_INDEX,
    negative: API_MAIN,
    rule: "local/require-export-contract",
    code: "const undocumented = 1;\nexport { undocumented };",
    positiveReports: true,
    negativeReports: false,
  },
  {
    id: "next-web",
    positive: WEB_LEAD_FORM,
    negative: "packages/ui/src/components/ui/card.tsx",
    rule: "@next/next/no-img-element",
    code: "export const ImageProbe = () => <img src='/x.png' alt='x' />;",
    positiveReports: true,
    negativeReports: false,
  },
  {
    id: "jsx-a11y-tabindex-positive",
    positive: WEB_LEAD_FORM,
    negative: WEB_LEAD_FORM_TEST,
    rule: "jsx-a11y/no-noninteractive-tabindex",
    code: "export const TabIndexProbe = () => <div tabIndex={0}>x</div>;",
    positiveReports: true,
    negativeReports: false,
  },
  {
    id: "jsx-a11y-group-region-negative",
    positive: WEB_LEAD_FORM,
    negative: WEB_LEAD_FORM_TEST,
    rule: "jsx-a11y/no-noninteractive-tabindex",
    code: "export const AllowedTabIndexProbe = () => <><div role='group' tabIndex={0}>g</div><div role='region' tabIndex={0}>r</div></>;",
    positiveReports: false,
    negativeReports: false,
  },
  {
    id: "web-api-boundary",
    positive: WEB_TRPC,
    negative: API_MAIN,
    rule: "@typescript-eslint/no-restricted-imports",
    code: "import { AppModule } from '@customreport/api';\nvoid AppModule;",
    positiveReports: true,
    negativeReports: false,
  },
  {
    id: "production-immutability",
    positive: API_MAIN,
    negative: API_FENCE_TEST,
    rule: "no-restricted-syntax",
    code: "export function count(): number { let value = 0; value += 1; return value; }",
    positiveReports: true,
    negativeReports: false,
  },
  {
    id: "report-page-prop-seam",
    positive: WEB_LEAD_FORM,
    negative:
      "apps/web/src/features/organization/ui/settings-identity-sub-tab.tsx",
    rule: "no-restricted-syntax",
    code: "declare function useValue(): string;\nexport type Props = ReturnType<typeof useValue>;",
    positiveReports: true,
    negativeReports: false,
  },
  {
    id: "session-parameter-ownership",
    positive: "apps/api/src/infrastructure/trpc/trpc.session-hydration.ts",
    negative: "apps/api/src/infrastructure/trpc/trpc.context.ts",
    rule: "no-param-reassign",
    code: "export function hydrate(session: { role: string }): void { session.role = 'viewer'; }",
    positiveReports: true,
    negativeReports: false,
  },
  {
    id: "domain-immutability",
    positive: "apps/api/src/modules/period/domain/period-transition.ts",
    negative: "apps/api/src/modules/period/module.ts",
    rule: "functional/immutable-data",
    code: "export function mutate(value: { state: string }): void { value.state = 'done'; }",
    positiveReports: true,
    negativeReports: false,
  },
  {
    id: "config-budget",
    positive: "apps/web/next.config.ts",
    negative: WEB_TRPC,
    rule: "max-lines",
    code: longSource,
    positiveReports: false,
    negativeReports: true,
  },
  {
    id: "eslint-policy-module-budget",
    positive: "eslint-config/core.ts",
    negative: WEB_TRPC,
    rule: "max-lines",
    code: longSource,
    positiveReports: false,
    negativeReports: true,
  },
  {
    id: "production-function-budget-boundary",
    positive: API_MAIN,
    negative: API_MAIN,
    rule: "max-lines-per-function",
    code: functionAtBudget,
    positiveReports: false,
    negativeReports: false,
  },
  {
    id: "production-function-budget-overflow",
    positive: API_MAIN,
    negative: API_FENCE_TEST,
    rule: "max-lines-per-function",
    code: functionOverBudget,
    positiveReports: true,
    negativeReports: false,
  },
  {
    id: "test-policy",
    positive: API_FENCE_TEST,
    negative: API_MAIN,
    rule: "vitest/no-focused-tests",
    code: "import { test } from 'vitest';\ntest.only('focused', () => {});",
    positiveReports: true,
    negativeReports: false,
  },
  {
    id: "literal-data-policy",
    positive: "apps/api/src/test-utils/report-section-fixtures.ts",
    negative: "apps/api/src/infrastructure/metrics/metrics.module.ts",
    rule: "@typescript-eslint/no-magic-numbers",
    code: "export function threshold(): number { return 37; }",
    positiveReports: false,
    negativeReports: true,
  },
  {
    id: "uat-vocabulary",
    positive: "apps/web/uat-suite/inventory.mjs",
    negative: "apps/web/uat-suite/helpers.mjs",
    rule: "sonarjs/no-duplicate-string",
    code: "export const a = 'fixture-vocabulary-long';\nexport const b = 'fixture-vocabulary-long';\nexport const c = 'fixture-vocabulary-long';\nexport const d = 'fixture-vocabulary-long';",
    positiveReports: false,
    negativeReports: true,
  },
  {
    id: "uat-inline-classifier",
    positive: "apps/web/uat-suite/inventory.mjs",
    negative: "apps/web/uat-suite/helpers.mjs",
    rule: "sonarjs/cognitive-complexity",
    code: complexSource,
    positiveReports: false,
    negativeReports: true,
  },
  {
    id: "playwright-fixture-contract",
    positive: "e2e/integration/fixtures.ts",
    negative: WEB_LEAD_FORM,
    rule: "react-hooks/rules-of-hooks",
    code: "declare function useValue(): number;\nexport async function fixture(use: (value: number) => Promise<void>): Promise<void> { await use(useValue()); }",
    positiveReports: false,
    negativeReports: true,
  },
];
