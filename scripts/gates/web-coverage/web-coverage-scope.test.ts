import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const webVitestConfig = readFileSync(
  resolve("apps/web/vitest.config.ts"),
  "utf8",
);

const escapedOpenParenthesis = String.raw`\(`;
const escapedCloseParenthesis = String.raw`\)`;

const rawGlobLiteral = (path: string): string =>
  [
    "String.raw`",
    path
      .replaceAll("(", escapedOpenParenthesis)
      .replaceAll(")", escapedCloseParenthesis),
    "`",
  ].join("");

const hasCoverageExclusion = (source: string, path: string): boolean =>
  source.includes(JSON.stringify(path)) ||
  source.includes(rawGlobLiteral(path));

// TOOL-COVERAGE-002: the broad `src/app/**/page.tsx` exclusion hid every route
// page from both the numerator and denominator of web coverage. Only
// framework-thin redirect aliases may be excluded wholesale; any page carrying
// behavioral logic must stay in coverage.

void test("web coverage does not exclude every route page by path", () => {
  assert.ok(
    !webVitestConfig.includes("src/app/**/page.tsx"),
    "the broad src/app/**/page.tsx exclusion must not come back",
  );
});

void test("framework-thin redirect aliases are the only page exclusions", () => {
  const expectedStubs = [
    "src/app/(app)/admin/products/page.tsx",
    "src/app/(app)/admin/activities/page.tsx",
    "src/app/(app)/admin/settings/page.tsx",
    "src/app/(app)/head/history/page.tsx",
    "src/app/(app)/head/slides/page.tsx",
    "src/app/(app)/lead/history/page.tsx",
    "src/app/(app)/reports/history/page.tsx",
  ];
  for (const stub of expectedStubs) {
    assert.ok(
      hasCoverageExclusion(webVitestConfig, stub),
      `redirect stub ${stub} is excluded wholesale`,
    );
  }
});

void test("the page-exclusion detector rejects a planted removed redirect", () => {
  const stub = "src/app/(app)/admin/products/page.tsx";
  const literal = rawGlobLiteral(stub);
  const mutated = webVitestConfig.replace(literal, "");
  assert.notEqual(mutated, webVitestConfig, "the planted exclusion must apply");
  assert.equal(hasCoverageExclusion(mutated, stub), false);
});

void test("behavioral route pages stay in the coverage include set", () => {
  // These pages carry client data loading, tab selection, or role-aware
  // rendering; excluding them wholesale would hide their logic from coverage.
  const behavioralPages = [
    "src/app/(app)/reports/trends/page.tsx",
    "src/app/(app)/reports/page.tsx",
    "src/app/(app)/admin/page.tsx",
    "src/app/(app)/lead/report/page.tsx",
    "src/app/(app)/head/dashboard/page.tsx",
  ];
  for (const page of behavioralPages) {
    assert.ok(
      !hasCoverageExclusion(webVitestConfig, page),
      `behavioral page ${page} must not be excluded wholesale`,
    );
  }
});
