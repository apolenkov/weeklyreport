import { describe, expect, it } from "vitest";

import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import {
  createFrozenCaseLiveShardPlan,
  MAX_FROZEN_CASE_LIVE_SHARD_CASES,
} from "./frozen-case-live-shards.ts";

const makeCase = (index: number): MatrixExecutableCase => ({
  caseId: `case-${String(index).padStart(6, "0")}`,
  stateId: "state-live-shard",
  sourceSha: "a".repeat(40),
  profile: "minimal",
  role: "lead",
  catalogRoute: "/lead/report",
  resolvedRoute: "/lead/report",
  state: {
    profileCapability: "editable-active-report",
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
      controlKey: "route:lead:/lead/report",
      operation: "navigate",
      safety: "read-only",
      transition: "none",
    },
  },
});

const ids = (cases: readonly MatrixExecutableCase[]): readonly string[] =>
  cases.map(({ caseId }) => caseId);

describe("frozen live replay shards", () => {
  it("emits no shard for an empty immutable matrix selection", () => {
    expect(createFrozenCaseLiveShardPlan([])).toEqual([]);
  });

  it("keeps one case in its only shard", () => {
    const cases = [makeCase(0)];
    const plan = createFrozenCaseLiveShardPlan(cases);

    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      shardIndex: 0,
      shardCount: 1,
      caseIds: ids(cases),
    });
  });

  it("splits 33 cases at 32 without dropping or reordering ids", () => {
    const cases = Array.from({ length: 33 }, (_, index) => makeCase(index));
    const plan = createFrozenCaseLiveShardPlan(cases);

    expect(plan.map(({ cases: shardCases }) => shardCases.length)).toEqual([
      MAX_FROZEN_CASE_LIVE_SHARD_CASES,
      1,
    ]);
    expect(plan.flatMap(({ caseIds }) => caseIds)).toEqual(ids(cases));
  });

  it("keeps a large matrix selection exact and ordered across every shard", () => {
    const cases = Array.from({ length: 32_007 }, (_, index) => makeCase(index));
    const plan = createFrozenCaseLiveShardPlan(cases);

    expect(plan.every(({ cases: shardCases }) => shardCases.length <= 32)).toBe(
      true,
    );
    expect(plan.flatMap(({ caseIds }) => caseIds)).toEqual(ids(cases));
    expect(plan.map(({ shardIndex }) => shardIndex)).toEqual(
      Array.from({ length: plan.length }, (_, index) => index),
    );
    expect(new Set(plan.flatMap(({ caseIds }) => caseIds)).size).toBe(
      cases.length,
    );
  });
});
