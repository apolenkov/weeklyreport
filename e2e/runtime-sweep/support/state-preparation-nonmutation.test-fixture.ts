import { vi } from "vitest";

import type {
  PreparedRuntimeState,
  RuntimeMutationLogEntry,
  RuntimeMutationSentinel,
  RuntimeStateDatabase,
} from "./state-preparation.ts";
import { buildStatePreparationPlan } from "./state-preparation.ts";

export const sentinel = [
  {
    id: "log-1",
    userId: "actor",
    role: "admin",
    procedure: "admin.actionLog.list",
    targetId: null,
    status: "success",
    reason: null,
    ip: null,
    correlationId: "seed-log-1",
    durationMs: 1,
    createdAt: "2020-01-01T00:00:00.000Z",
  },
] as const satisfies RuntimeMutationSentinel;
export const changedSentinel = [
  ...sentinel,
  {
    id: "log-2",
    userId: "actor",
    role: "admin",
    procedure: "admin.savePolicy",
    targetId: "policy",
    status: "success",
    reason: null,
    ip: null,
    correlationId: "mutation-log-2",
    durationMs: 2,
    createdAt: "2020-01-01T00:00:01.000Z",
  },
] as const satisfies RuntimeMutationSentinel;
export const changedEntrySentinel = [
  {
    ...sentinel[0],
    procedure: "admin.otherAction",
    targetId: "policy",
    status: "fail",
  },
] as const satisfies RuntimeMutationSentinel;
export const changedMetadataSentinel = [
  { ...sentinel[0], correlationId: "changed-correlation" },
] as const satisfies RuntimeMutationSentinel;
const secondSentinelEntry = {
  id: "log-2",
  userId: "actor",
  role: "admin",
  procedure: "admin.readOnlyAction",
  targetId: "report",
  status: "success",
  reason: null,
  ip: null,
  correlationId: "seed-log-2",
  durationMs: 2,
  createdAt: "2020-01-01T00:00:01.000Z",
} as const;
export const orderedSentinel = [
  sentinel[0],
  secondSentinelEntry,
] as const satisfies RuntimeMutationSentinel;
export const reorderedSentinel = [
  secondSentinelEntry,
  sentinel[0],
] as const satisfies RuntimeMutationSentinel;
export const manyAddedSentinel: RuntimeMutationSentinel = Array.from(
  { length: 11 },
  (_, index): RuntimeMutationLogEntry => ({
    ...secondSentinelEntry,
    id: `log-${index + 2}`,
    procedure: `admin.addedAction${index}`,
    targetId: `target-${index}`,
    correlationId: `added-correlation-${index}`,
  }),
);

export const prepared = {
  plan: buildStatePreparationPlan({
    profile: "full",
    routeRole: "admin",
    routeTarget: "active",
    axes: {
      lifecycle: "open",
      submission: "draft",
      ownership: "single",
      permission: "allowed",
    },
    repoRoot: "/workspace/customreport",
  }),
  actual: {
    report: {
      status: "draft",
      periodState: "open",
      periodStatus: "open",
      archived: false,
    },
    section: {
      status: "draft",
      submittedAt: "absent",
      verdict: "none",
      version: 1,
    },
    ownership: {
      targetOwnerId: "actor",
      owners: ["actor"],
      assignments: [],
    },
    permission: {
      actorId: "actor",
      actorRole: "admin",
      authenticated: true,
      allowed: true,
      ownsTarget: true,
    },
  },
  mutationSentinel: sentinel,
  observation: { matches: true, mismatches: [] },
} satisfies PreparedRuntimeState;

export const databaseFor = (
  snapshots: readonly PreparedRuntimeState["actual"][],
  sentinels: readonly RuntimeMutationSentinel[] = snapshots.map(
    () => prepared.mutationSentinel,
  ),
): RuntimeStateDatabase => {
  const readSnapshot = vi.fn(() => {
    const snapshot = snapshots[readSnapshot.mock.calls.length - 1];
    if (snapshot === undefined) throw new Error("Missing test snapshot");
    return Promise.resolve(snapshot);
  });
  const readMutationSentinel = vi.fn(() => {
    const mutationSentinel =
      sentinels[readMutationSentinel.mock.calls.length - 1];
    if (mutationSentinel === undefined)
      throw new Error("Missing test mutation sentinel");
    return Promise.resolve(mutationSentinel);
  });
  return {
    transaction: (work) =>
      work({
        updateReport: () => Promise.resolve(),
        updateSection: () => Promise.resolve(),
        replaceOwnership: () => Promise.resolve(),
        readSnapshot,
        readMutationSentinel,
        readViewerGroupAccess: () => Promise.resolve([]),
        removeViewerGroupAccess: () => Promise.resolve(0),
      }),
  };
};
