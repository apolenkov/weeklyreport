import assert from "node:assert/strict";
import test from "node:test";

import {
  parseStructuralInventoryArgs,
  strictStructuralRuleGaps,
  STRUCTURAL_PRODUCT_ROOTS,
  STRUCTURAL_RULE_CONFIG,
} from "./exemplary-structure-contract.ts";
import {
  selectStructuralFiles,
  summarizeStructuralFindings,
} from "./exemplary-structure-inventory.ts";

void test("inventory arguments default to the complete product denominator", () => {
  assert.deepEqual(parseStructuralInventoryArgs([]), {
    denominator: "product",
    scopes: STRUCTURAL_PRODUCT_ROOTS,
  });
});

void test("inventory arguments accept repeated maintained scopes and a control denominator", () => {
  assert.deepEqual(
    parseStructuralInventoryArgs([
      "--",
      "--scope",
      "apps/api/src/modules/admin/",
      "--scope",
      "packages/ui/src",
      "--denominator",
      "all-source",
    ]),
    {
      denominator: "all-source",
      scopes: ["apps/api/src/modules/admin", "packages/ui/src"],
    },
  );
});

void test("inventory arguments reject scope escape and unknown values", () => {
  assert.throws(
    () => parseStructuralInventoryArgs(["--scope", "scripts"]),
    /outside maintained product roots/u,
  );
  assert.throws(
    () => parseStructuralInventoryArgs(["--scope", "../apps/api/src"]),
    /Invalid structural scope/u,
  );
  assert.throws(
    () => parseStructuralInventoryArgs(["--denominator", "tests"]),
    /product or all-source/u,
  );
});

void test("product selection uses the one role classifier and the control retains tests", () => {
  const files = [
    "apps/api/src/main.ts",
    "apps/api/src/main.test.ts",
    "apps/web/src/features/report.tsx",
    "packages/ui/src/dialog.test.tsx",
  ];
  assert.deepEqual(
    selectStructuralFiles(files, {
      denominator: "product",
      scopes: STRUCTURAL_PRODUCT_ROOTS,
    }),
    ["apps/api/src/main.ts", "apps/web/src/features/report.tsx"],
  );
  assert.deepEqual(
    selectStructuralFiles(files, {
      denominator: "all-source",
      scopes: ["apps/api/src"],
    }),
    ["apps/api/src/main.ts", "apps/api/src/main.test.ts"],
  );
});

void test("finding summaries retain exact rule counts and affected files", () => {
  const finding = (
    file: string,
    ruleId:
      | "max-lines"
      | "max-lines-per-function"
      | "complexity"
      | "sonarjs/cognitive-complexity",
  ) => ({ file, ruleId, line: 1, column: 1, message: "probe" });
  const summary = summarizeStructuralFindings([
    finding("apps/api/src/a.ts", "max-lines"),
    finding("apps/api/src/a.ts", "complexity"),
    finding("apps/api/src/b.ts", "complexity"),
  ]);
  assert.deepEqual(summary["max-lines"], {
    occurrences: 1,
    fileCount: 1,
    files: ["apps/api/src/a.ts"],
  });
  assert.deepEqual(summary.complexity, {
    occurrences: 2,
    fileCount: 2,
    files: ["apps/api/src/a.ts", "apps/api/src/b.ts"],
  });
  assert.equal(summary["max-lines-per-function"].occurrences, 0);
  assert.equal(summary["sonarjs/cognitive-complexity"].occurrences, 0);
});

void test("strict config proof rejects a return to transitional limits", () => {
  assert.deepEqual(strictStructuralRuleGaps(STRUCTURAL_RULE_CONFIG), []);
  assert.deepEqual(
    strictStructuralRuleGaps({
      "max-lines": [2, { max: 300 }],
      "max-lines-per-function": [2, { max: 70 }],
      complexity: [2, 20],
      "sonarjs/cognitive-complexity": [2, 10],
    }),
    [
      "max-lines",
      "max-lines-per-function",
      "complexity",
      "sonarjs/cognitive-complexity",
    ],
  );
  assert.deepEqual(
    strictStructuralRuleGaps({
      ...STRUCTURAL_RULE_CONFIG,
      complexity: "off",
    }),
    ["complexity"],
  );
  assert.deepEqual(
    strictStructuralRuleGaps({
      ...STRUCTURAL_RULE_CONFIG,
      complexity: ["warn", 10],
    }),
    ["complexity"],
  );
  assert.deepEqual(
    strictStructuralRuleGaps({
      ...STRUCTURAL_RULE_CONFIG,
      "max-lines": [1, { max: 230 }],
    }),
    ["max-lines"],
  );
});
