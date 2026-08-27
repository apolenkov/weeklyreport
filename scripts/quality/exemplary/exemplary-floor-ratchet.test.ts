import assert from "node:assert/strict";
import test from "node:test";

import {
  type FloorSnapshot,
  parseFloorSnapshot,
  ratchetViolations,
} from "./exemplary-floor-ratchet.ts";
import type {
  StructuralDebtCounts,
  StructuralFloorSnapshot,
} from "./exemplary-structural-snapshot.ts";
import { STRUCTURAL_PRODUCT_SLICES } from "./exemplary-structure-contract.ts";

const EMPTY_DEBT: StructuralDebtCounts = {
  findingCount: 0,
  affectedFileCount: 0,
  byRule: {
    "max-lines": 0,
    "max-lines-per-function": 0,
    complexity: 0,
    "sonarjs/cognitive-complexity": 0,
  },
};

const STRUCTURAL_BASELINE: StructuralFloorSnapshot = {
  denominatorFileCount: 925,
  total: {
    ...EMPTY_DEBT,
    findingCount: 2,
    affectedFileCount: 2,
    byRule: { ...EMPTY_DEBT.byRule, complexity: 2 },
  },
  bySlice: Object.fromEntries(
    STRUCTURAL_PRODUCT_SLICES.map(({ id }) => [
      id,
      id === "api-admin"
        ? {
            ...EMPTY_DEBT,
            findingCount: 2,
            affectedFileCount: 2,
            byRule: { ...EMPTY_DEBT.byRule, complexity: 2 },
          }
        : EMPTY_DEBT,
    ]),
  ),
  inlineSuppressions: 0,
  perFileWeakenings: 0,
  notStrictConfigFileCount: 925,
  notStrictConfigBySlice: Object.fromEntries(
    STRUCTURAL_PRODUCT_SLICES.map(({ id }) => [
      id,
      id === "api-remainder" ? 925 : 0,
    ]),
  ),
};

const BASELINE: FloorSnapshot = {
  filesOnFloor: 828,
  productTotal: 925,
  overrideBlocks: 27,
  liveSuppressions: 140,
  structural: STRUCTURAL_BASELINE,
};

const changed = (patch: Partial<FloorSnapshot>): FloorSnapshot => ({
  ...BASELINE,
  ...patch,
});

void test("an exact current snapshot passes", () => {
  assert.deepEqual(ratchetViolations(BASELINE, BASELINE), []);
});

void test("every current counter is checked against the baseline", () => {
  assert.equal(
    ratchetViolations(
      changed({ filesOnFloor: 827, productTotal: 926 }),
      BASELINE,
    ).length,
    2,
  );
  assert.equal(
    ratchetViolations(changed({ overrideBlocks: 28 }), BASELINE).length,
    1,
  );
  assert.equal(
    ratchetViolations(changed({ liveSuppressions: 141 }), BASELINE).length,
    1,
  );
});

void test("an improvement must update the baseline in the same commit", () => {
  assert.match(
    ratchetViolations(changed({ filesOnFloor: 829 }), BASELINE)[0] ?? "",
    /does not match baseline/,
  );
});

void test("baseline history rejects all three forbidden directions", () => {
  const weakened = changed({
    filesOnFloor: 827,
    overrideBlocks: 28,
    liveSuppressions: 141,
  });
  assert.deepEqual(ratchetViolations(weakened, weakened, BASELINE), [
    "baseline regressed: filesOnFloor 828 -> 827",
    "baseline regressed: overrideBlocks 27 -> 28",
    "baseline regressed: liveSuppressions 140 -> 141",
  ]);
});

void test("baseline history accepts improvements", () => {
  const improved = changed({
    filesOnFloor: 829,
    overrideBlocks: 26,
    liveSuppressions: 139,
  });
  assert.deepEqual(ratchetViolations(improved, improved, BASELINE), []);
});

void test("baseline history accepts an exact, stated regression justification", () => {
  const reclassified = {
    ...changed({ filesOnFloor: 827 }),
    justifiedRegressions: [
      {
        counter: "filesOnFloor" as const,
        from: 828,
        to: 827,
        reason: "An A-class fixture moved from product code to test utilities.",
      },
    ],
  };
  assert.deepEqual(ratchetViolations(reclassified, reclassified, BASELINE), []);
});

void test("a mismatched justification does not weaken the ratchet", () => {
  const weakened = {
    ...changed({ filesOnFloor: 827 }),
    justifiedRegressions: [
      {
        counter: "filesOnFloor" as const,
        from: 829,
        to: 827,
        reason: "Does not describe the actual first-parent transition.",
      },
    ],
  };
  assert.deepEqual(ratchetViolations(weakened, weakened, BASELINE), [
    "baseline regressed: filesOnFloor 828 -> 827",
  ]);
});

void test("product file count is exact for the tree but not directional in history", () => {
  const reclassified = changed({ productTotal: 924 });
  assert.deepEqual(ratchetViolations(reclassified, reclassified, BASELINE), []);
});

void test("structural findings are exact for the current tree", () => {
  const actual = changed({
    structural: {
      ...STRUCTURAL_BASELINE,
      total: {
        ...STRUCTURAL_BASELINE.total,
        findingCount: 1,
        byRule: { ...STRUCTURAL_BASELINE.total.byRule, complexity: 1 },
      },
    },
  });
  assert.deepEqual(ratchetViolations(actual, BASELINE), [
    "current structural snapshot does not match baseline",
  ]);
});

void test("structural rule and slice counts cannot regress or be justified", () => {
  const regressedStructural: StructuralFloorSnapshot = {
    ...STRUCTURAL_BASELINE,
    total: {
      ...STRUCTURAL_BASELINE.total,
      findingCount: 3,
      affectedFileCount: 3,
      byRule: { ...STRUCTURAL_BASELINE.total.byRule, complexity: 3 },
    },
    bySlice: {
      ...STRUCTURAL_BASELINE.bySlice,
      "api-admin": {
        findingCount: 3,
        affectedFileCount: 3,
        byRule: { ...EMPTY_DEBT.byRule, complexity: 3 },
      },
    },
  };
  const baseline = {
    ...BASELINE,
    structural: regressedStructural,
    justifiedRegressions: [
      {
        counter: "filesOnFloor" as const,
        from: 828,
        to: 828,
        reason: "Cannot authorize a structural regression.",
      },
    ],
  };
  const violations = ratchetViolations(baseline, baseline, BASELINE);
  assert.ok(
    violations.includes(
      "structural baseline regressed: total.byRule.complexity 2 -> 3",
    ),
  );
  assert.ok(
    violations.includes(
      "structural baseline regressed: bySlice.api-admin.byRule.complexity 2 -> 3",
    ),
  );
});

void test("structural suppressions and per-file weakenings cannot increase", () => {
  const weakened = changed({
    structural: {
      ...STRUCTURAL_BASELINE,
      inlineSuppressions: 1,
      perFileWeakenings: 1,
    },
  });
  const violations = ratchetViolations(weakened, weakened, BASELINE);
  assert.ok(
    violations.includes(
      "structural baseline regressed: inlineSuppressions 0 -> 1",
    ),
  );
  assert.ok(
    violations.includes(
      "structural baseline regressed: perFileWeakenings 0 -> 1",
    ),
  );
});

void test("returning a completed slice to transitional config is a regression", () => {
  const previous = changed({
    structural: {
      ...STRUCTURAL_BASELINE,
      notStrictConfigFileCount: 900,
      notStrictConfigBySlice: {
        ...STRUCTURAL_BASELINE.notStrictConfigBySlice,
        shared: 0,
      },
    },
  });
  const reverted = changed({
    structural: {
      ...STRUCTURAL_BASELINE,
      notStrictConfigFileCount: 925,
      notStrictConfigBySlice: {
        ...STRUCTURAL_BASELINE.notStrictConfigBySlice,
        shared: 25,
      },
    },
  });
  const violations = ratchetViolations(reverted, reverted, previous);
  assert.ok(
    violations.includes(
      "structural baseline regressed: notStrictConfigFileCount 900 -> 925",
    ),
  );
  assert.ok(
    violations.includes(
      "structural baseline regressed: notStrictConfigBySlice.shared 0 -> 25",
    ),
  );
});

void test("baseline parsing rejects a non-array regression list", () => {
  assert.throws(
    () =>
      parseFloorSnapshot(
        JSON.stringify({ ...BASELINE, justifiedRegressions: "approved" }),
      ),
    /justified regressions list/,
  );
});
