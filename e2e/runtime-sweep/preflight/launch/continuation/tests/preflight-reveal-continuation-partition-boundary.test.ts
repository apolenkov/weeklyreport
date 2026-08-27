import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../../../support/ids.ts";
import {
  createRevealPartitionPlan,
  createRevealPartitionReceipt,
  emptyRevealAggregatePartitionState,
  parseRevealPartitionPlan,
  reduceRevealPartitionReceipt,
  type RevealPartitionChain,
} from "../preflight-reveal-continuation-partition.ts";
import { partitionBoundaryAuthorityTagFor } from "../preflight-reveal-continuation-partition-support.ts";

const AUTHORITY_KEY = "partition-boundary-authority";

const plan = () =>
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

const rehashedDigestFor = (body: object): string =>
  sha256Hex(
    Object.fromEntries(
      Object.entries(body).filter(([key]) => key !== "partitionReceiptDigest"),
    ),
  );

describe("reveal aggregate partition boundaries", () => {
  it.each([2, 257])(
    "accepts the exact partition boundary candidate count %i",
    (endCandidateCount) => {
      expect(() =>
        createRevealPartitionReceipt({
          plan: plan(),
          state: emptyRevealAggregatePartitionState(),
          partitionIndex: 0,
          attemptId: "attempt-boundary",
          authorityKey: AUTHORITY_KEY,
          startChildOrdinal: 0,
          endChildOrdinal: 0,
          endCandidateCount,
          startCheckpointDigest: null,
          endCheckpointDigest: sha256Hex(`checkpoint-${endCandidateCount}`),
          startSampleSequence: null,
          endSampleSequence: 61,
          startGrantDigest: null,
          endGrantDigest: sha256Hex(`grant-${endCandidateCount}`),
          frontier: "non-empty",
          cleanupEvidence: cleanupEvidence(0, 0),
          endChain: chain({
            receiptCount: endCandidateCount,
            chunkCount: 1,
            operationChunkCount: 1,
            suffix: `boundary-${endCandidateCount}`,
          }),
        }),
      ).not.toThrow();
    },
  );

  it("rejects a non-empty boundary without candidate progress", () => {
    expect(() =>
      createRevealPartitionReceipt({
        plan: plan(),
        state: emptyRevealAggregatePartitionState(),
        partitionIndex: 0,
        attemptId: "attempt-underflow",
        authorityKey: AUTHORITY_KEY,
        startChildOrdinal: 0,
        endChildOrdinal: 0,
        endCandidateCount: 0,
        startCheckpointDigest: null,
        endCheckpointDigest: sha256Hex("checkpoint-underflow"),
        startSampleSequence: null,
        endSampleSequence: 61,
        startGrantDigest: null,
        endGrantDigest: sha256Hex("grant-underflow"),
        frontier: "non-empty",
        cleanupEvidence: cleanupEvidence(0, 0),
        endChain: chain({
          receiptCount: 1,
          chunkCount: 1,
          operationChunkCount: 1,
          suffix: "underflow",
        }),
      }),
    ).toThrow("candidate range is invalid");
  });

  it("rejects a rehashed receipt when the operation head does not advance", () => {
    const currentPlan = plan();
    const initial = emptyRevealAggregatePartitionState();
    const first = createRevealPartitionReceipt({
      plan: currentPlan,
      state: initial,
      partitionIndex: 0,
      attemptId: "attempt-chain",
      authorityKey: AUTHORITY_KEY,
      startChildOrdinal: 0,
      endChildOrdinal: 0,
      endCandidateCount: 2,
      startCheckpointDigest: null,
      endCheckpointDigest: sha256Hex("checkpoint-chain-1"),
      startSampleSequence: null,
      endSampleSequence: 61,
      startGrantDigest: null,
      endGrantDigest: sha256Hex("grant-chain-1"),
      frontier: "non-empty",
      cleanupEvidence: cleanupEvidence(0, 0),
      endChain: chain({
        receiptCount: 2,
        chunkCount: 1,
        operationChunkCount: 1,
        suffix: "chain-1",
      }),
    });
    const afterFirst = reduceRevealPartitionReceipt({
      plan: currentPlan,
      state: initial,
      receipt: first,
      authorityKey: AUTHORITY_KEY,
    });
    const forgedBody = {
      ...first,
      partitionIndex: 1,
      partitionId: "partition-0002" as const,
      predecessorPartitionDigest: afterFirst.partitionHead,
      startChildOrdinal: 1,
      endChildOrdinal: 1,
      startCandidateCount: 2,
      endCandidateCount: 4,
      startCheckpointDigest: afterFirst.checkpointDigest,
      endCheckpointDigest: sha256Hex("checkpoint-chain-2"),
      startSampleSequence: afterFirst.sampleSequence,
      endSampleSequence: 62,
      startGrantDigest: afterFirst.grantDigest,
      endGrantDigest: afterFirst.grantDigest,
      startChain: afterFirst.chain,
      endChain: {
        ...afterFirst.chain,
        receiptHead: sha256Hex("receipt-chain-2"),
        receiptCount: 4,
        chunkHead: sha256Hex("chunk-chain-2"),
        chunkCount: 2,
        operationChunkCount: 2,
        operationHead: afterFirst.chain.operationHead,
      },
      cleanupEvidence: cleanupEvidence(1, 1),
      frontier: "empty" as const,
      partitionReceiptDigest: "",
    };
    const {
      boundaryAuthorityTag: _boundaryAuthorityTag,
      partitionReceiptDigest: _partitionReceiptDigest,
      ...forgedBoundaryBody
    } = forgedBody;
    const signedForgedBody = {
      ...forgedBoundaryBody,
      boundaryAuthorityTag: partitionBoundaryAuthorityTagFor(
        AUTHORITY_KEY,
        forgedBoundaryBody,
      ),
    };
    const forged = {
      ...signedForgedBody,
      partitionReceiptDigest: rehashedDigestFor(signedForgedBody),
    };
    expect(() =>
      reduceRevealPartitionReceipt({
        plan: currentPlan,
        state: afterFirst,
        receipt: forged,
        authorityKey: AUTHORITY_KEY,
      }),
    ).toThrow("operation head did not advance");
  });

  it("rejects a rehashed receipt whose checkpoint predecessor is forged", () => {
    const currentPlan = plan();
    const initial = emptyRevealAggregatePartitionState();
    const valid = createRevealPartitionReceipt({
      plan: currentPlan,
      state: initial,
      partitionIndex: 0,
      attemptId: "attempt-boundary-tamper",
      authorityKey: AUTHORITY_KEY,
      startChildOrdinal: 0,
      endChildOrdinal: 0,
      endCandidateCount: 2,
      startCheckpointDigest: null,
      endCheckpointDigest: sha256Hex("checkpoint-tamper"),
      startSampleSequence: null,
      endSampleSequence: 61,
      startGrantDigest: null,
      endGrantDigest: sha256Hex("grant-tamper"),
      frontier: "non-empty",
      cleanupEvidence: cleanupEvidence(0, 0),
      endChain: chain({
        receiptCount: 2,
        chunkCount: 1,
        operationChunkCount: 1,
        suffix: "tamper",
      }),
    });
    const forgedBody = {
      ...valid,
      startCheckpointDigest: sha256Hex("forged-predecessor"),
      partitionReceiptDigest: "",
    };
    const forged = {
      ...forgedBody,
      partitionReceiptDigest: rehashedDigestFor(forgedBody),
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

  it("rejects a rehashed plan whose supervisor budget is not derived", () => {
    const original = plan();
    const tamperedBody = {
      ...original,
      supervisorMaxMs: original.supervisorMaxMs + 1,
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
      "supervisor budget is not derived",
    );
  });
});
