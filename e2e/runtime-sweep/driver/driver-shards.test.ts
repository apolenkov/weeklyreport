import { expect, test } from "vitest";

import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import {
  assertDriverShardResult,
  assertExactDriverShardCaseIds,
  createDriverShardPlan,
  DriverShardError,
} from "./driver-shards.ts";

const SOURCE_SHA = "a".repeat(40);

const makeCase = (
  caseId: string,
  route = "/lead/report",
): MatrixExecutableCase => ({
  caseId,
  stateId: "state-report",
  sourceSha: SOURCE_SHA,
  profile: "minimal",
  role: "lead",
  catalogRoute: route,
  resolvedRoute: route,
  state: {
    profileCapability: "canonical-identities",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "none",
  },
  kind: "executable",
  execution: {
    kind: "navigation",
    action: {
      controlKey: `route:lead:${route}`,
      operation: "navigate",
      safety: "read-only",
      transition: "none",
    },
  },
});

test("keeps 32 exact case ids in one deterministic shard", () => {
  const cases = Array.from({ length: 32 }, (_, index) =>
    makeCase(`case-${String(index).padStart(2, "0")}`),
  );

  const plan = createDriverShardPlan(cases.toReversed(), "none");

  expect(plan.totalShards).toBe(1);
  expect(plan.assignments[0]?.caseIds).toEqual(
    cases.map(({ caseId }) => caseId),
  );
  expect(plan.assignments[0]?.shardIndex).toBe(0);
  expect(plan.assignments[0]?.executionLane).toMatchObject({
    caseCount: 32,
    actionCount: 32,
    observationCount: 0,
  });
});

test("splits 33 cases as 32 plus 1 and ignores input order", () => {
  const cases = Array.from({ length: 33 }, (_, index) =>
    makeCase(`case-${String(index).padStart(2, "0")}`),
  );

  const first = createDriverShardPlan(cases, "none");
  const second = createDriverShardPlan(cases.toReversed(), "none");

  expect(first.assignments.map(({ caseIds }) => caseIds.length)).toEqual([
    32, 1,
  ]);
  expect(second).toEqual(first);
});

test("keeps different routes in separate profile-role-route lanes", () => {
  const plan = createDriverShardPlan(
    [makeCase("case-b", "/lead/other"), makeCase("case-a")],
    "none",
  );

  expect(plan.assignments.map(({ catalogRoute }) => catalogRoute)).toEqual([
    "/lead/other",
    "/lead/report",
  ]);
  expect(plan.assignments.every(({ caseIds }) => caseIds.length === 1)).toBe(
    true,
  );
});

test("keeps different frozen states in separate route-state lanes", () => {
  const first = makeCase("case-a");
  const second = {
    ...makeCase("case-b"),
    stateId: "state-case-b",
    state: { ...first.state, lifecycle: "reopened" as const },
  };

  const plan = createDriverShardPlan([first, second], "active");

  expect(plan.assignments.map(({ caseIds }) => caseIds.length)).toEqual([1, 1]);
  expect(plan.assignments.map(({ stateId }) => stateId)).toEqual([
    "state-case-b",
    "state-report",
  ]);
  expect(
    plan.assignments.every(({ routeTarget }) => routeTarget === "active"),
  ).toBe(true);
});

test("rejects a state id whose frozen axes disagree", () => {
  const first = makeCase("case-a");
  const second = {
    ...makeCase("case-b"),
    stateId: first.stateId,
    state: { ...first.state, lifecycle: "reopened" as const },
  };

  expect(() => createDriverShardPlan([first, second], "active")).toThrow(
    /mixed case identity/iu,
  );
});

test("rejects missing, extra, and reordered result ids", () => {
  const shard = createDriverShardPlan(
    [makeCase("case-a"), makeCase("case-b")],
    "none",
  ).assignments[0];
  if (!shard) throw new Error("test shard missing");

  expect(() => assertExactDriverShardCaseIds(shard, ["case-a"])).toThrow(
    /missing result case case-b/iu,
  );
  expect(() =>
    assertExactDriverShardCaseIds(shard, ["case-a", "case-c"]),
  ).toThrow(/missing result case case-b.*out-of-shard result case case-c/iu);
  expect(() =>
    assertExactDriverShardCaseIds(shard, ["case-b", "case-a"]),
  ).toThrow(/canonical/iu);
});

test("rejects a report that references a case outside its shard", () => {
  const shard = createDriverShardPlan([makeCase("case-a")], "none")
    .assignments[0];
  if (!shard) throw new Error("test shard missing");

  expect(() =>
    assertDriverShardResult(shard, {
      assignedCells: [{ cellId: "case-a" }],
      controlResults: [{ cellId: "case-outside" }],
    }),
  ).toThrow(DriverShardError);
});
