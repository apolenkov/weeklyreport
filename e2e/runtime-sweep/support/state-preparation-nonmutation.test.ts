import { describe, expect, it, vi } from "vitest";

import type {
  PreparedRuntimeState,
  RuntimeMutationLogEntry,
  RuntimeMutationSentinel,
  RuntimeStateDatabase,
} from "./state-preparation.ts";
import { provePreparedStateNonMutation } from "./state-preparation-nonmutation.ts";

const sentinel = [
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
const changedSentinel = [
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
const changedEntrySentinel = [
  {
    ...sentinel[0],
    procedure: "admin.otherAction",
    targetId: "policy",
    status: "fail",
  },
] as const satisfies RuntimeMutationSentinel;
const changedMetadataSentinel = [
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
const orderedSentinel = [
  sentinel[0],
  secondSentinelEntry,
] as const satisfies RuntimeMutationSentinel;
const reorderedSentinel = [
  secondSentinelEntry,
  sentinel[0],
] as const satisfies RuntimeMutationSentinel;
const manyAddedSentinel: RuntimeMutationSentinel = Array.from(
  { length: 11 },
  (_, index): RuntimeMutationLogEntry => ({
    ...secondSentinelEntry,
    id: `log-${index + 2}`,
    procedure: `admin.addedAction${index}`,
    targetId: `target-${index}`,
    correlationId: `added-correlation-${index}`,
  }),
);

const prepared = {
  plan: {
    targets: { reportId: "report", sectionId: "section" },
    permission: { boundary: "allowed", actorId: "actor", groupId: "group" },
  },
  actual: { report: { id: "report" }, sections: [] },
  mutationSentinel: sentinel,
} as unknown as PreparedRuntimeState;

const databaseFor = (
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

describe("prepared-state non-mutation proof", () => {
  it("binds equal snapshots around the exact action", async () => {
    const action = vi.fn(() => Promise.resolve());
    const settle = vi.fn(() => Promise.resolve());
    const proof = await provePreparedStateNonMutation({
      database: databaseFor([prepared.actual, prepared.actual]),
      prepared,
      settle,
      action,
    });
    expect(proof.beforeDigest).toBe(proof.afterDigest);
    expect(action).toHaveBeenCalledOnce();
    expect(settle).toHaveBeenCalledTimes(2);
  });

  it("rejects drift before or after the action", async () => {
    const changed = { ...prepared.actual, changed: true } as never;
    await expect(
      provePreparedStateNonMutation({
        database: databaseFor([changed]),
        prepared,
        settle: () => Promise.resolve(),
        action: () => Promise.resolve(),
      }),
    ).rejects.toThrow(/before reveal/iu);
    await expect(
      provePreparedStateNonMutation({
        database: databaseFor([prepared.actual, changed]),
        prepared,
        settle: () => Promise.resolve(),
        action: () => Promise.resolve(),
      }),
    ).rejects.toThrow(/after reveal/iu);
  });

  it("reports an added entry with only bounded structural fields", async () => {
    await expect(
      provePreparedStateNonMutation({
        database: databaseFor(
          [prepared.actual, prepared.actual],
          [sentinel, changedSentinel],
        ),
        prepared,
        settle: () => Promise.resolve(),
        action: () => Promise.resolve(),
      }),
    ).rejects.toThrow(
      /expectedCount=1; actualCount=2;.*added=.*log-2.*admin\.savePolicy.*success.*policy.*removedCount=0; removed=\[\];.*changedCount=0; changed=\[\];.*orderChanged=false/iu,
    );
  });
  it("reports changed and removed entries without exposing payload fields", async () => {
    await expect(
      provePreparedStateNonMutation({
        database: databaseFor(
          [prepared.actual, prepared.actual],
          [sentinel, changedEntrySentinel],
        ),
        prepared,
        settle: () => Promise.resolve(),
        action: () => Promise.resolve(),
      }),
    ).rejects.toThrow(/changed=.*admin\.otherAction.*fail.*policy/iu);

    await expect(
      provePreparedStateNonMutation({
        database: databaseFor(
          [prepared.actual, prepared.actual],
          [sentinel, []],
        ),
        prepared,
        settle: () => Promise.resolve(),
        action: () => Promise.resolve(),
      }),
    ).rejects.toThrow(
      /expectedCount=1; actualCount=0;.*added=\[\];.*removed=.*log-1.*admin\.actionLog\.list.*success.*changed=\[\]/iu,
    );

    await expect(
      provePreparedStateNonMutation({
        database: databaseFor(
          [prepared.actual, prepared.actual],
          [sentinel, changedMetadataSentinel],
        ),
        prepared,
        settle: () => Promise.resolve(),
        action: () => Promise.resolve(),
      }),
    ).rejects.toThrow(/changedCount=1; changed=.*log-1/iu);
  });
  it("bounds structural detail while preserving total delta counts", async () => {
    const error = await provePreparedStateNonMutation({
      database: databaseFor(
        [prepared.actual, prepared.actual],
        [sentinel, manyAddedSentinel],
      ),
      prepared,
      settle: () => Promise.resolve(),
      action: () => Promise.resolve(),
    }).catch((error_: unknown) => error_);

    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) return;
    expect(error.message).toContain("addedCount=11");
    expect(error.message).toContain('"id":"log-11"');
    expect(error.message).not.toMatch(
      /log-12|correlationId|durationMs|createdAt|reason|ip/iu,
    );
  });

  it("reports deterministic reorder deltas without weakening the sentinel", async () => {
    const preparedWithTwoEntries = {
      ...prepared,
      mutationSentinel: orderedSentinel,
    } as PreparedRuntimeState;

    await expect(
      provePreparedStateNonMutation({
        database: databaseFor(
          [prepared.actual, prepared.actual],
          [orderedSentinel, reorderedSentinel],
        ),
        prepared: preparedWithTwoEntries,
        settle: () => Promise.resolve(),
        action: () => Promise.resolve(),
      }),
    ).rejects.toThrow(
      /expectedCount=2; actualCount=2;.*added=\[\];.*removed=\[\];.*changed=\[\];.*orderChanged=true/iu,
    );
  });

  it("checks the database after a failed action before rethrowing", async () => {
    const actionError = new Error("action failed");
    await expect(
      provePreparedStateNonMutation({
        database: databaseFor([prepared.actual, prepared.actual]),
        prepared,
        settle: () => Promise.resolve(),
        action: () => Promise.reject(actionError),
      }),
    ).rejects.toBe(actionError);
  });

  it("checks the mutation sentinel after a failed action before rethrowing", async () => {
    const actionError = new Error("action failed");
    await expect(
      provePreparedStateNonMutation({
        database: databaseFor(
          [prepared.actual, prepared.actual],
          [sentinel, changedSentinel],
        ),
        prepared,
        settle: () => Promise.resolve(),
        action: () => Promise.reject(actionError),
      }),
    ).rejects.toThrow(/mutation sentinel changed after reveal/iu);
  });

  it("checks the mutation sentinel when action and post-action settling both fail", async () => {
    const settle = vi
      .fn<() => Promise<void>>()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error("settling failed"));

    await expect(
      provePreparedStateNonMutation({
        database: databaseFor(
          [prepared.actual, prepared.actual],
          [sentinel, changedSentinel],
        ),
        prepared,
        settle,
        action: () => Promise.reject(new Error("action failed")),
      }),
    ).rejects.toThrow(/mutation sentinel changed after reveal/iu);
    expect(settle).toHaveBeenCalledTimes(2);
  });
});
