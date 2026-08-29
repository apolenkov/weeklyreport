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
      ),
    /empty lines denominator/,
  );
});
