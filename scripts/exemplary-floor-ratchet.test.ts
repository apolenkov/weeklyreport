import assert from "node:assert/strict";
import test from "node:test";

import {
  type FloorSnapshot,
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
