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
const WEB_LEAD_FORM = "apps/web/src/features/report-pages/ui/lead-form.tsx";
const WEB_TRPC = "apps/web/src/lib/trpc.ts";
const longSource = Array.from(
  { length: 255 },
  (_unused, index) => `export const line${index} = ${index};`,
).join("\n");
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
    positive: "packages/shared/src/index.ts",
    negative: API_MAIN,
    rule: "jsdoc/require-jsdoc",
    code: "export function undocumented(value: string): string { return value; }",
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
    negative: "apps/api/src/app.module.fence.test.ts",
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
    id: "test-policy",
    positive: "apps/api/src/app.module.fence.test.ts",
    negative: API_MAIN,
    rule: "vitest/no-focused-tests",
    code: "import { test } from 'vitest';\ntest.only('focused', () => {});",
    positiveReports: true,
    negativeReports: false,
  },
  {
    id: "literal-data-policy",
    positive: "apps/api/src/infrastructure/metrics/web-vitals.metrics.ts",
    negative: "apps/api/src/infrastructure/metrics/metrics.module.ts",
    rule: "@typescript-eslint/no-magic-numbers",
    code: "export function threshold(): number { return 37; }",
    positiveReports: false,
    negativeReports: true,
  },
  {
    id: "uat-vocabulary",
    positive: "apps/web/uat-suite/helpers.mjs",
    negative: "scripts/find-status-literal-unions.mjs",
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
