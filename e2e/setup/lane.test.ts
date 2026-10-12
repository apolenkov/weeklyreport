import assert from "node:assert/strict";
import test from "node:test";

import { resolveE2eLane } from "./lane.js";

void test("without E2E_LANE the shared weeklyreport_e2e / Redis 15 target is used", () => {
  for (const env of [{}, { E2E_LANE: "" }]) {
    assert.deepEqual(resolveE2eLane(env), {
      database: "weeklyreport_e2e",
      redisDb: "15",
    });
  }
});

void test("lanes a and b get their own database and distinct Redis DBs", () => {
  const a = resolveE2eLane({ E2E_LANE: "a" });
  const b = resolveE2eLane({ E2E_LANE: "b" });
  assert.deepEqual(a, {
    database: "weeklyreport_e2e_lane_a_test",
    redisDb: "1",
  });
  assert.deepEqual(b, {
    database: "weeklyreport_e2e_lane_b_test",
    redisDb: "2",
  });
  const shared = resolveE2eLane({});
  assert.equal(new Set([a.database, b.database, shared.database]).size, 3);
  assert.equal(new Set([a.redisDb, b.redisDb, shared.redisDb]).size, 3);
});

void test("unprovisioned lanes and malformed values are refused", () => {
  for (const lane of ["c", "o", "A", "e2e", "a ", "lane_a", "constructor"]) {
    assert.throws(
      () => resolveE2eLane({ E2E_LANE: lane }),
      /E2E_LANE must be unset, "a" or "b"/u,
    );
  }
});
