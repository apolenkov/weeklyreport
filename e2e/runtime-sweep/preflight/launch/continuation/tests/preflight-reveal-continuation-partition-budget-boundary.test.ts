import { access, mkdtemp, rm } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../../../support/ids.ts";
import { selectionFor } from "../../../reveal/continuation/preflight-reveal-continuation-fixture.ts";
import type { RequestHostCheckpoint } from "../../checkpoint/preflight-reveal-host-checkpoint-client.ts";
import { responseFor } from "../../checkpoint/preflight-reveal-host-checkpoint-parent-test-fixture.ts";
import { runChildUntilPartitionBoundary } from "../../checkpoint/preflight-reveal-host-checkpoint-partition.ts";
import { RevealContinuationBudgetError } from "../preflight-reveal-continuation-budget-error.ts";
import type {
  ParentContext,
  ParentProgress,
} from "../preflight-reveal-continuation-parent.ts";
import { initialParentProgress } from "../preflight-reveal-continuation-parent-progress.ts";
import { withCleanSource } from "../preflight-reveal-continuation-parent-test-fixture.ts";
import {
  createRevealPartitionPlan,
  createRevealPartitionReceipt,
  emptyRevealAggregatePartitionState,
  reduceRevealPartitionReceipt,
} from "../preflight-reveal-continuation-partition.ts";

const planFor = () =>
  createRevealPartitionPlan({
    campaignId: "campaign-1",
    sourceSha: "b".repeat(40),
    sourceTree: "c".repeat(40),
    sourceDigest: "a".repeat(64),
    planDigest: "d".repeat(64),
    stateId: "state-1",
    stateDigest: "e".repeat(64),
    profile: "demo",
    role: "admin",
    route: "/admin",
    routeDigest: "f".repeat(64),
    maxRevealActions: 4,
    partitionCandidateLimit: 2,
    partitionMaxMs: 200_000,
    teardownReserveMs: 360_000,
  });

const chainFor = (count: number) => ({
  receiptHead: sha256Hex(`receipt-${count}`),
  receiptCount: count,
  chunkHead: sha256Hex(`chunk-${count}`),
  chunkCount: 1,
  operationHead: sha256Hex(`operation-${count}`),
  operationChunkCount: 1,
  operationTotals: {
    fullReplayActions: count,
    candidateActions: count,
    inverseActions: 0,
    successfulRestorations: 0,
    consumedLeases: 0,
    physicalActions: count,
    chargedActions: count,
  },
});

const cleanupFor = () => [
  {
    status: "PASS" as const,
    ownership: "OWNED" as const,
    processGroup: "GONE" as const,
    pid: 20_000,
    pgid: 20_000,
    childOrdinal: 0,
  },
];

const progressFor = (count: number): ParentProgress => ({
  ...initialParentProgress(),
  previousGrantDigest: sha256Hex(`grant-${count}`),
  previousCompletedCandidateCount: count,
  receiptHead: sha256Hex(`receipt-${count}`),
  receiptCount: count,
  chunkHead: sha256Hex(`chunk-${count}`),
  chunkCount: 1,
  operationHead: sha256Hex(`operation-${count}`),
  operationChunkCount: 1,
  operationTotals: chainFor(count).operationTotals,
});

const contextFor = (input: {
  readonly source: ParentContext["source"];
  readonly repoRoot: string;
  readonly archiveRoot: string;
  readonly monotonicNow: () => number;
}): ParentContext => {
  const state = input.source.plan.states[0];
  if (state === undefined) throw new Error("Fixture has no state");
  const { selection, route: revealRoute } = selectionFor(
    input.source,
    state.stateId,
  );
  const requestHostCheckpoint = Object.assign(
    ({ request }: Parameters<RequestHostCheckpoint>[0]) =>
      Promise.resolve(responseFor(request)),
    { complete: () => Promise.resolve() },
  );
  return {
    source: input.source,
    repoRoot: input.repoRoot,
    archiveRoot: input.archiveRoot,
    canaryPath: path.join(input.archiveRoot, "PREFLIGHT_CANARY.json"),
    baselineReceiptDigest: "d".repeat(64),
    selection,
    revealRoute,
    authorityKey: "a".repeat(64),
    attemptId: "aggregate-budget-boundary",
    chunkBudget: "1000",
    chunkBudgetMs: 1000,
    deadlineAt: 100_000,
    deadlineMonotonic: 100_000,
    functionalDeadlineAt: 100_000,
    functionalDeadlineMonotonic: 100_000,
    signal: new AbortController().signal,
    now: () => 100,
    monotonicNow: input.monotonicNow,
    runPlaywright: () =>
      Promise.reject(new Error("Browser launch was not expected")),
    requestHostCheckpoint,
  };
};

describe("aggregate partition budget boundaries", () => {
  it("accepts a positive partial range when a partition closes on time", () => {
    const currentPlan = planFor();
    const initial = emptyRevealAggregatePartitionState();
    const receipt = createRevealPartitionReceipt({
      plan: currentPlan,
      state: initial,
      partitionIndex: 0,
      attemptId: "attempt-time-boundary",
      authorityKey: "partition-boundary-authority",
      startChildOrdinal: 0,
      endChildOrdinal: 0,
      endCandidateCount: 1,
      startCheckpointDigest: null,
      endCheckpointDigest: sha256Hex("checkpoint-time-boundary"),
      startSampleSequence: null,
      endSampleSequence: 61,
      startGrantDigest: null,
      endGrantDigest: sha256Hex("grant-time-boundary"),
      frontier: "non-empty",
      cleanupEvidence: cleanupFor(),
      endChain: chainFor(1),
    });
    const reduced = reduceRevealPartitionReceipt({
      plan: currentPlan,
      state: initial,
      receipt,
      authorityKey: "partition-boundary-authority",
    });
    expect(reduced).toMatchObject({
      nextPartitionIndex: 1,
      completedCandidateCount: 1,
      status: "OPEN",
    });
  });

  it("turns pre-launch budget exhaustion into a partial partition boundary", async () => {
    await withCleanSource(async ({ source, repoRoot }) => {
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r-aggregate-budget-boundary-"),
      );
      try {
        let monotonicIndex = 0;
        const context = contextFor({
          source,
          repoRoot,
          archiveRoot,
          monotonicNow: () => (monotonicIndex++ < 5 ? 0 : 100_000),
        });
        let childCalls = 0;
        const result = await runChildUntilPartitionBoundary({
          context,
          progress: initialParentProgress(),
          ordinal: 0,
          maxChildren: 2,
          partitionStartCandidateCount: 0,
          partitionCandidateLimit: 1024,
          runChild: ({ context: childContext, ordinal }) => {
            childCalls += 1;
            childContext.onChildCleanup?.({
              status: "PASS",
              ownership: "OWNED",
              processGroup: "GONE",
              pid: 20_000 + ordinal,
              pgid: 20_000 + ordinal,
              childOrdinal: ordinal,
            });
            return Promise.resolve({
              done: false,
              progress: progressFor(1),
            });
          },
        });
        expect(childCalls).toBe(1);
        expect(result).toMatchObject({
          status: "BOUNDARY",
          completedChildOrdinal: 0,
          nextOrdinal: 1,
          exitCode: 0,
          progress: { previousCompletedCandidateCount: 1 },
        });
        await expect(access(context.canaryPath)).rejects.toMatchObject({
          code: "ENOENT",
        });
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });

  it("turns an inner pre-launch budget race into a partial partition boundary", async () => {
    await withCleanSource(async ({ source, repoRoot }) => {
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r-aggregate-inner-budget-boundary-"),
      );
      try {
        const context = contextFor({
          source,
          repoRoot,
          archiveRoot,
          monotonicNow: () => 0,
        });
        let childCalls = 0;
        const result = await runChildUntilPartitionBoundary({
          context,
          progress: initialParentProgress(),
          ordinal: 0,
          maxChildren: 2,
          partitionStartCandidateCount: 0,
          partitionCandidateLimit: 1024,
          runChild: ({ context: childContext, ordinal }) => {
            childCalls += 1;
            if (ordinal > 0)
              throw new RevealContinuationBudgetError({
                remainingMs: 88_499,
                requiredMs: 100_000,
              });
            childContext.onChildCleanup?.({
              status: "PASS",
              ownership: "OWNED",
              processGroup: "GONE",
              pid: 21_000,
              pgid: 21_000,
              childOrdinal: ordinal,
            });
            return Promise.resolve({
              done: false,
              progress: progressFor(1),
            });
          },
        });
        expect(childCalls).toBe(2);
        expect(result).toMatchObject({
          status: "BOUNDARY",
          completedChildOrdinal: 0,
          nextOrdinal: 1,
          exitCode: 0,
          progress: { previousCompletedCandidateCount: 1 },
        });
        await expect(access(context.canaryPath)).rejects.toMatchObject({
          code: "ENOENT",
        });
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });
});
