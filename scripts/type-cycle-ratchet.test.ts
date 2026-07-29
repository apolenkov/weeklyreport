import assert from "node:assert/strict";
import test from "node:test";

import {
  cycleRatchetViolations,
  parseCycleBaseline,
} from "./type-cycle-ratchet.ts";

const cycles = (count: number) =>
  Array.from({ length: count }, () => ({ rule: { name: "no-circular" } }));

void test("a snapshot matching its stored cycle baseline passes", () => {
  assert.deepEqual(cycleRatchetViolations(cycles(27), { cycles: 27 }), []);
});

void test("a cycle above the stored baseline fails", () => {
  assert.deepEqual(cycleRatchetViolations(cycles(28), { cycles: 27 }), [
    "current type-only cycles=28 does not match baseline 27",
  ]);
});

void test("an improvement requires the baseline to move in the same commit", () => {
  assert.deepEqual(cycleRatchetViolations(cycles(26), { cycles: 27 }), [
    "current type-only cycles=26 does not match baseline 27",
  ]);
});

void test("baseline history rejects an increase", () => {
  assert.deepEqual(
    cycleRatchetViolations(cycles(28), { cycles: 28 }, { cycles: 27 }),
    ["type-cycle baseline regressed: 27 -> 28"],
  );
});

void test("unrelated dependency violations cannot hide behind the cycle debt", () => {
  assert.deepEqual(
    cycleRatchetViolations(
      [...cycles(27), { rule: { name: "not-to-unresolvable" } }],
      { cycles: 27 },
    ),
    ["type-only cruise has unrelated violation: not-to-unresolvable"],
  );
});

void test("the baseline parser rejects non-integer debt", () => {
  assert.throws(() => parseCycleBaseline('{"cycles": 27.5}'));
});
