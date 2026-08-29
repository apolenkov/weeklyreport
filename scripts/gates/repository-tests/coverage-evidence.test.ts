import assert from "node:assert/strict";
import test from "node:test";

import { assertNonEmptyCoverageSummary } from "../coverage/coverage-evidence.ts";

const metric = (total: number) => ({ total, covered: total });

void test("accepts a coverage summary with executed files and all metric denominators", () => {
  const evidence = assertNonEmptyCoverageSummary(
    {
      "src/example.ts": {},
      total: {
        lines: metric(3),
        statements: metric(3),
        functions: metric(1),
        branches: metric(2),
      },
    },
    "fixture/coverage-summary.json",
    "api",
    "/workspace/apps/api",
  );
  assert.equal(evidence.fileCount, 1);
  assert.equal(evidence.totals.lines, 3);
});

void test("rejects an empty execution denominator even when the report is present", () => {
  assert.throws(
    () =>
      assertNonEmptyCoverageSummary(
        {
          "src/example.ts": {},
          total: {
            lines: metric(0),
            statements: metric(1),
            functions: metric(1),
            branches: metric(1),
          },
        },
        "fixture/coverage-summary.json",
        "api",
        "/workspace/apps/api",
      ),
    /empty lines denominator/,
  );
});

void test("rejects metadata and stray paths as file evidence", () => {
  for (const strayKey of [
    "coverageMap",
    "package.json",
    "src/example.test.ts",
  ]) {
    assert.throws(
      () =>
        assertNonEmptyCoverageSummary(
          {
            [strayKey]: {},
            total: {
              lines: metric(3),
              statements: metric(3),
              functions: metric(1),
              branches: metric(2),
            },
          },
          "fixture/coverage-summary.json",
          "api",
          "/workspace/apps/api",
        ),
      /metadata, stray, or excluded file key/,
    );
  }
});

void test("rejects a valid source path from the other package scope", () => {
  assert.throws(
    () =>
      assertNonEmptyCoverageSummary(
        {
          "/workspace/apps/web/src/app/page.tsx": {},
          total: {
            lines: metric(3),
            statements: metric(3),
            functions: metric(1),
            branches: metric(2),
          },
        },
        "fixture/coverage-summary.json",
        "api",
        "/workspace/apps/api",
      ),
    /metadata, stray, or excluded file key/,
  );
});

void test("accepts an absolute path inside the selected source scope", () => {
  const evidence = assertNonEmptyCoverageSummary(
    {
      "/workspace/apps/api/src/modules/example.ts": {},
      total: {
        lines: metric(3),
        statements: metric(3),
        functions: metric(1),
        branches: metric(2),
      },
    },
    "fixture/coverage-summary.json",
    "api",
    "/workspace/apps/api",
  );
  assert.equal(evidence.fileCount, 1);
});

void test("rejects ambiguous relative paths when cwd belongs to another package", () => {
  assert.throws(
    () =>
      assertNonEmptyCoverageSummary(
        {
          "src/modules/example.ts": {},
          total: {
            lines: metric(3),
            statements: metric(3),
            functions: metric(1),
            branches: metric(2),
          },
        },
        "fixture/coverage-summary.json",
        "api",
        "/workspace/apps/web",
      ),
    /scope api does not match package root/,
  );
});
