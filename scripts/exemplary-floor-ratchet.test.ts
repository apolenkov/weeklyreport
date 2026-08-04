import assert from "node:assert/strict";
import test from "node:test";

import {
  type FloorSnapshot,
  parseFloorSnapshot,
  ratchetViolations,
} from "./exemplary-floor-ratchet.ts";

const BASELINE: FloorSnapshot = {
  filesOnFloor: 828,
  productTotal: 925,
  overrideBlocks: 27,
  liveSuppressions: 140,
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

void test("baseline parsing rejects a non-array regression list", () => {
  assert.throws(
    () =>
      parseFloorSnapshot(
        JSON.stringify({ ...BASELINE, justifiedRegressions: "approved" }),
      ),
    /justified regressions list/,
  );
});
