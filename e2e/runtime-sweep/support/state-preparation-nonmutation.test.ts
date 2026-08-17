import { describe, expect, it, vi } from "vitest";

import type {
  RevealExecutionTiming,
  RevealExecutionTimingStage,
} from "../preflight/reveal/interaction/preflight-reveal-types.ts";
import type { PreparedRuntimeState } from "./state-preparation.ts";
import {
  changedEntrySentinel,
  changedMetadataSentinel,
  changedSentinel,
  databaseFor,
  manyAddedSentinel,
  orderedSentinel,
  prepared,
  reorderedSentinel,
  sentinel,
} from "./state-preparation-nonmutation.test-fixture.ts";
import { provePreparedStateNonMutation } from "./state-preparation-nonmutation.ts";

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

  it("attributes each non-mutation phase when timing is enabled", async () => {
    const phases: RevealExecutionTimingStage[] = [];
    const timing: RevealExecutionTiming = {
      span: (phase, operation) => {
        phases.push(phase);
        return operation();
      },
    };

    await provePreparedStateNonMutation({
      database: databaseFor([prepared.actual, prepared.actual]),
      prepared,
      settle: () => Promise.resolve(),
      action: () => Promise.resolve(),
      timing,
    });

    expect(phases.join(",")).toBe(
      "preSettle,beforeSnapshot,action,postSettle,afterSnapshot",
    );
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
