import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../../support/ids.ts";
import {
  assertRevealAggregateComplete,
  createRevealPartitionPlan,
  createRevealPartitionReceipt,
  emptyRevealAggregatePartitionState,
  parseRevealPartitionPlan,
  reduceRevealPartitionReceipt,
  type RevealPartitionChain,
} from "./preflight-reveal-continuation-partition.ts";

const DIGEST = "a".repeat(64);
const SOURCE_SHA = "b".repeat(40);
const SOURCE_TREE = "c".repeat(40);
const AUTHORITY_KEY = "partition-test-authority";
const plan = () =>
  createRevealPartitionPlan({
    campaignId: "campaign-1",
    sourceSha: SOURCE_SHA,
    sourceTree: SOURCE_TREE,
    sourceDigest: DIGEST,
    planDigest: "d".repeat(64),
    stateId: "state-1",
    stateDigest: "e".repeat(64),
    profile: "demo",
    role: "admin",
    route: "/admin?tab=actions",
    routeDigest: "f".repeat(64),
    maxRevealActions: 4,
    partitionCandidateLimit: 2,
    partitionMaxMs: 200_000,
    teardownReserveMs: 360_000,
  });

const chain = (input: {
  readonly receiptCount: number;
  readonly chunkCount: number;
  readonly operationChunkCount?: number;
  readonly suffix: string;
}): RevealPartitionChain => ({
  receiptHead:
    input.receiptCount === 0 ? null : sha256Hex(`receipt-${input.suffix}`),
  receiptCount: input.receiptCount,
  chunkHead: input.chunkCount === 0 ? null : sha256Hex(`chunk-${input.suffix}`),
  chunkCount: input.chunkCount,
  operationHead:
    (input.operationChunkCount ?? 0) === 0
      ? null
      : sha256Hex(`operation-${input.suffix}`),
  operationChunkCount: input.operationChunkCount ?? 0,
  operationTotals: {
    fullReplayActions: input.receiptCount,
    candidateActions: input.receiptCount,
    inverseActions: 0,
    successfulRestorations: 0,
    consumedLeases: 0,
    physicalActions: input.receiptCount,
    chargedActions: input.receiptCount,
  },
});

const cleanupEvidence = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => ({
    status: "PASS" as const,
    ownership: "OWNED" as const,
    processGroup: "GONE" as const,
    pid: 10_000 + start + index,
    pgid: 10_000 + start + index,
    childOrdinal: start + index,
  }));

describe("reveal aggregate partition contract", () => {
  it("creates and parses a deterministic contiguous plan", () => {
    const first = plan();
    const second = plan();
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      candidateRangePolicy:
        "predecessor-end-contiguous-with-single-terminal-overshoot",
      deadlinePolicy:
        "partition-functional-budget-plus-global-teardown-reserve",
      partitionMaxMs: 200_000,
      teardownReserveMs: 360_000,
      supervisorMaxMs: 760_000,
    });
    expect(first.partitions).toEqual([
      {
        partitionId: "partition-0001",
        partitionIndex: 0,
        maxEndCandidateCountExclusive: 257,
      },
      {
        partitionId: "partition-0002",
        partitionIndex: 1,
        maxEndCandidateCountExclusive: 259,
      },
    ]);
    expect(parseRevealPartitionPlan(first)).toEqual(first);
  });

  it("rejects a gap or overlap even when the tampered plan is rehashed", () => {
    const original = plan();
    const tamperedBody = {
      ...original,
      partitions: original.partitions.map((entry, index) =>
        index === 1 ? { ...entry, maxEndCandidateCountExclusive: 999 } : entry,
      ),
    };
    const tampered = {
      ...tamperedBody,
      partitionPlanDigest: sha256Hex(
        Object.fromEntries(
          Object.entries(tamperedBody).filter(
            ([key]) => key !== "partitionPlanDigest",
          ),
        ),
      ),
    };

    expect(() => parseRevealPartitionPlan(tampered)).toThrow(
      "not contiguous or canonical",
    );
  });

  it("reduces two partitions only through the exact predecessor chain", () => {
    const currentPlan = plan();
    const initial = emptyRevealAggregatePartitionState();
    const first = createRevealPartitionReceipt({
      plan: currentPlan,
      state: initial,
      partitionIndex: 0,
      attemptId: "attempt-1",
      authorityKey: AUTHORITY_KEY,
      startChildOrdinal: 0,
      endChildOrdinal: 0,
      endCandidateCount: 2,
      startCheckpointDigest: null,
      endCheckpointDigest: sha256Hex("checkpoint-0"),
      startSampleSequence: null,
      endSampleSequence: 61,
      startGrantDigest: null,
      endGrantDigest: sha256Hex("grant-0"),
      frontier: "non-empty",
      cleanupEvidence: cleanupEvidence(0, 0),
      endChain: chain({
        receiptCount: 2,
        chunkCount: 1,
        operationChunkCount: 1,
        suffix: "one",
      }),
    });
    const afterFirst = reduceRevealPartitionReceipt({
      plan: currentPlan,
      state: initial,
      receipt: first,
      authorityKey: AUTHORITY_KEY,
    });
    const second = createRevealPartitionReceipt({
      plan: currentPlan,
      state: afterFirst,
      partitionIndex: 1,
      attemptId: "attempt-1",
      authorityKey: AUTHORITY_KEY,
      startChildOrdinal: 1,
      endChildOrdinal: 1,
      endCandidateCount: 4,
      startCheckpointDigest: afterFirst.checkpointDigest,
      endCheckpointDigest: sha256Hex("checkpoint-1"),
      startSampleSequence: afterFirst.sampleSequence,
      endSampleSequence: 62,
      startGrantDigest: afterFirst.grantDigest,
      endGrantDigest: afterFirst.grantDigest,
      frontier: "empty",
      cleanupEvidence: cleanupEvidence(1, 1),
      endChain: chain({
        receiptCount: 4,
        chunkCount: 2,
        operationChunkCount: 2,
        suffix: "two",
      }),
    });
    const complete = reduceRevealPartitionReceipt({
      plan: currentPlan,
      state: afterFirst,
      receipt: second,
      authorityKey: AUTHORITY_KEY,
    });

    expect(complete.status).toBe("COMPLETE");
    expect(complete.completedCandidateCount).toBe(4);
    expect(() =>
      assertRevealAggregateComplete({ plan: currentPlan, state: complete }),
    ).not.toThrow();

    const forged = {
      ...second,
      predecessorPartitionDigest: DIGEST,
      partitionReceiptDigest: "",
    };
    forged.partitionReceiptDigest = sha256Hex(
      Object.fromEntries(
        Object.entries(forged).filter(
          ([key]) => key !== "partitionReceiptDigest",
        ),
      ),
    );
    expect(() =>
      reduceRevealPartitionReceipt({
        plan: currentPlan,
        state: afterFirst,
        receipt: forged,
        authorityKey: AUTHORITY_KEY,
      }),
    ).toThrow("boundary authority tag drifted");
  });

  it("rejects a receipt that exceeds its planned boundary", () => {
    const currentPlan = plan();
    expect(() =>
      createRevealPartitionReceipt({
        plan: currentPlan,
        state: emptyRevealAggregatePartitionState(),
        partitionIndex: 0,
        attemptId: "attempt-1",
        authorityKey: AUTHORITY_KEY,
        startChildOrdinal: 0,
        endChildOrdinal: 0,
        endCandidateCount: 258,
        startCheckpointDigest: null,
        endCheckpointDigest: sha256Hex("checkpoint-overflow"),
        startSampleSequence: null,
        endSampleSequence: 61,
        startGrantDigest: null,
        endGrantDigest: sha256Hex("grant-overflow"),
        frontier: "non-empty",
        cleanupEvidence: cleanupEvidence(0, 0),
        endChain: chain({
          receiptCount: 258,
          chunkCount: 1,
          operationChunkCount: 1,
          suffix: "partial",
        }),
      }),
    ).toThrow("range is invalid");
  });

  it("rejects a rehashed receipt whose grant successor is forged", () => {
    const currentPlan = plan();
    const initial = emptyRevealAggregatePartitionState();
    const valid = createRevealPartitionReceipt({
      plan: currentPlan,
      state: initial,
      partitionIndex: 0,
      attemptId: "attempt-grant-tamper",
      authorityKey: AUTHORITY_KEY,
      startChildOrdinal: 0,
      endChildOrdinal: 0,
      endCandidateCount: 2,
      startCheckpointDigest: null,
      endCheckpointDigest: sha256Hex("checkpoint-grant-tamper"),
      startSampleSequence: null,
      endSampleSequence: 61,
      startGrantDigest: null,
      endGrantDigest: sha256Hex("grant-grant-tamper"),
      frontier: "non-empty",
      cleanupEvidence: cleanupEvidence(0, 0),
      endChain: chain({
        receiptCount: 2,
        chunkCount: 1,
        operationChunkCount: 1,
        suffix: "grant-tamper",
      }),
    });
    const forgedBody = {
      ...valid,
      endGrantDigest: sha256Hex("forged-grant-successor"),
      partitionReceiptDigest: "",
    };
    const forged = {
      ...forgedBody,
      partitionReceiptDigest: sha256Hex(
        Object.fromEntries(
          Object.entries(forgedBody).filter(
            ([key]) => key !== "partitionReceiptDigest",
          ),
        ),
      ),
    };
    expect(() =>
      reduceRevealPartitionReceipt({
        plan: currentPlan,
        state: initial,
        receipt: forged,
        authorityKey: AUTHORITY_KEY,
      }),
    ).toThrow("boundary authority tag drifted");
  });
});
