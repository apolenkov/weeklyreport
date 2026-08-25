import { describe, expect, it } from "vitest";

import type { MatrixExecutableCase } from "../../../matrix/matrix-finalizer.ts";
import { NO_ROUTE_CACHE_CONTRACT_POLICY } from "../../../source/contracts.ts";
import {
  createFrozenCaseLiveShardPlan,
  frozenCasePreparationKey,
  type FrozenCasePreparationRoute,
  groupFrozenCases,
  isReusableFrozenCase,
  MAX_FROZEN_CASE_LIVE_SHARD_CASES,
  selectFrozenCasesForReplay,
} from "./frozen-case-live-shards.ts";

const makeCase = (index: number): MatrixExecutableCase => ({
  caseId: `case-${String(index).padStart(6, "0")}`,
  stateId: "state-live-shard",
  sourceSha: "a".repeat(40),
  profile: "minimal",
  role: "lead",
  catalogRoute: "/lead/report",
  resolvedRoute: "/lead/report",
  networkPolicy: NO_ROUTE_CACHE_CONTRACT_POLICY,
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

const activeRoute = {
  role: "lead",
  catalogRoute: "/lead/report",
  resolvedRoute: "/lead/report",
  target: "active",
} satisfies FrozenCasePreparationRoute;

const publishedRoute = {
  ...activeRoute,
  catalogRoute: "/reports/published",
  resolvedRoute: "/reports/published",
  target: "published",
} satisfies FrozenCasePreparationRoute;

const REPO_ROOT = "/repo";

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

  it("selects explicit resume cases in frozen matrix order", () => {
    const cases = Array.from({ length: 4 }, (_, index) => makeCase(index));

    expect(
      ids(selectFrozenCasesForReplay(cases, "case-000003,case-000001")),
    ).toEqual(["case-000001", "case-000003"]);
  });

  it.each([
    ["empty", "case-000001,"],
    ["duplicate", "case-000001,case-000001"],
    ["unknown", "case-999999"],
  ])("rejects %s explicit resume identities", (_label, requested) => {
    expect(() => selectFrozenCasesForReplay([makeCase(1)], requested)).toThrow(
      /RUNTIME_SWEEP_CASE_IDS/u,
    );
  });

  it("groups cases by first-seen state target without reordering a group", () => {
    const cases = Array.from({ length: 4 }, (_, index) => makeCase(index));
    const groups = groupFrozenCases(cases, ({ caseId }) =>
      ["case-000000", "case-000002"].includes(caseId)
        ? "minimal:published"
        : "minimal:active",
    );

    expect(groups.map(ids)).toEqual([
      ["case-000000", "case-000002"],
      ["case-000001", "case-000003"],
    ]);
  });

  it("reuses only no-fault navigation, idle, and read-only controls", () => {
    const navigation = makeCase(0);
    const readOnlyControl = {
      ...makeCase(1),
      execution: {
        kind: "control",
        action: {
          controlKey: "button:inspect",
          operation: "click",
          safety: "read-only",
          transition: "none",
        },
      },
    } satisfies MatrixExecutableCase;
    const mutatingControl = {
      ...readOnlyControl,
      execution: {
        ...readOnlyControl.execution,
        action: {
          ...readOnlyControl.execution.action,
          safety: "reversible",
        },
      },
    } satisfies MatrixExecutableCase;
    const faulted = {
      ...navigation,
      state: { ...navigation.state, fault: "network-timeout" },
    } satisfies MatrixExecutableCase;

    expect(isReusableFrozenCase(navigation)).toBe(true);
    expect(isReusableFrozenCase(readOnlyControl)).toBe(true);
    expect(isReusableFrozenCase(mutatingControl)).toBe(false);
    expect(isReusableFrozenCase(faulted)).toBe(false);
  });

  it("keys reusable preparation by preparation, not case or action identity", () => {
    const first = {
      ...makeCase(1),
      profile: "full",
      execution: {
        kind: "control",
        action: {
          controlKey: "button:inspect:1",
          operation: "click",
          safety: "read-only",
          transition: "none",
        },
      },
    } satisfies MatrixExecutableCase;
    const samePreparation = {
      ...first,
      caseId: "another-case",
      stateId: "another-state",
      execution: {
        ...first.execution,
        action: { ...first.execution.action, controlKey: "button:other:1" },
      },
    } satisfies MatrixExecutableCase;

    expect(frozenCasePreparationKey(first, activeRoute, REPO_ROOT)).toBe(
      frozenCasePreparationKey(samePreparation, activeRoute, REPO_ROOT),
    );
    expect(frozenCasePreparationKey(first, activeRoute, REPO_ROOT)).not.toBe(
      frozenCasePreparationKey(first, publishedRoute, REPO_ROOT),
    );
  });

  const fullCase = {
    ...makeCase(2),
    profile: "full",
  } satisfies MatrixExecutableCase;

  const preparationKeyChanges: readonly (readonly [
    string,
    MatrixExecutableCase,
  ])[] = [
    ["sourceSha", { ...fullCase, sourceSha: "b".repeat(40) }],
    ["profile", { ...fullCase, profile: "demo" }],
    [
      "profileCapability",
      {
        ...fullCase,
        state: { ...fullCase.state, profileCapability: "canonical-identities" },
      },
    ],
    [
      "lifecycle",
      { ...fullCase, state: { ...fullCase.state, lifecycle: "reopened" } },
    ],
    [
      "submission",
      { ...fullCase, state: { ...fullCase.state, submission: "submitted" } },
    ],
    [
      "ownershipDensity",
      {
        ...fullCase,
        state: { ...fullCase.state, ownershipDensity: "multiple" },
      },
    ],
    [
      "permission",
      { ...fullCase, state: { ...fullCase.state, permission: "forbidden" } },
    ],
    ["fault", { ...fullCase, state: { ...fullCase.state, fault: "http-5xx" } }],
    [
      "controlTransition",
      {
        ...fullCase,
        state: { ...fullCase.state, controlTransition: "submit" },
      },
    ],
  ];

  it.each(preparationKeyChanges)(
    "changes the preparation key when %s changes",
    (_label, changed) => {
      expect(
        frozenCasePreparationKey(fullCase, activeRoute, REPO_ROOT),
      ).not.toBe(frozenCasePreparationKey(changed, activeRoute, REPO_ROOT));
    },
  );

  const routeChanges: readonly (readonly [
    string,
    FrozenCasePreparationRoute,
  ])[] = [
    ["role", { ...activeRoute, role: "head" }],
    ["catalogRoute", { ...activeRoute, catalogRoute: "/head/report" }],
    ["resolvedRoute", { ...activeRoute, resolvedRoute: "/reports/active" }],
    ["target", publishedRoute],
  ];

  it.each(routeChanges)(
    "changes the preparation key when route %s changes",
    (_label, route) => {
      expect(
        frozenCasePreparationKey(fullCase, activeRoute, REPO_ROOT),
      ).not.toBe(frozenCasePreparationKey(fullCase, route, REPO_ROOT));
    },
  );

  it("changes the preparation key when repoRoot changes", () => {
    expect(frozenCasePreparationKey(fullCase, activeRoute, REPO_ROOT)).not.toBe(
      frozenCasePreparationKey(fullCase, activeRoute, "/other-repo"),
    );
  });
});
