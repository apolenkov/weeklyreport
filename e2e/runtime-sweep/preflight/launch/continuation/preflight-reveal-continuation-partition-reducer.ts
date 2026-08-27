import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import type {
  RevealAggregateCompletion,
  RevealPartitionChain,
  RevealPartitionPlan,
  RevealPartitionReceipt,
} from "./preflight-reveal-continuation-partition-contract.ts";
import {
  aggregateCompletionBodySchema,
  PREFLIGHT_REVEAL_AGGREGATE_COMPLETION_SCOPE,
  PREFLIGHT_REVEAL_AGGREGATE_PARTITION_CLEANUP_SCOPE,
  PREFLIGHT_REVEAL_AGGREGATE_PARTITION_VERSION,
  revealAggregateCompletionSchema,
} from "./preflight-reveal-continuation-partition-contract.ts";
import {
  assertPartitionBoundaryAuthority,
  assertPartitionChainProgress,
  assertPartitionCleanupEvidence,
} from "./preflight-reveal-continuation-partition-support.ts";

export type RevealAggregatePartitionState = Readonly<{
  readonly nextPartitionIndex: number;
  readonly completedCandidateCount: number;
  readonly partitionHead: string | null;
  readonly chain: RevealPartitionChain;
  readonly attemptId: string | null;
  readonly nextChildOrdinal: number;
  readonly checkpointDigest: string | null;
  readonly sampleSequence: number | null;
  readonly grantDigest: string | null;
  readonly cleanupEvidenceCount: number;
  readonly status: "OPEN" | "COMPLETE";
}>;

const zeroChain = (): RevealPartitionChain => ({
  receiptHead: null,
  receiptCount: 0,
  chunkHead: null,
  chunkCount: 0,
  operationHead: null,
  operationChunkCount: 0,
  operationTotals: {
    fullReplayActions: 0,
    candidateActions: 0,
    inverseActions: 0,
    successfulRestorations: 0,
    consumedLeases: 0,
    physicalActions: 0,
    chargedActions: 0,
  },
});

export const emptyRevealAggregatePartitionState =
  (): RevealAggregatePartitionState => ({
    nextPartitionIndex: 0,
    completedCandidateCount: 0,
    partitionHead: null,
    chain: zeroChain(),
    attemptId: null,
    nextChildOrdinal: 0,
    checkpointDigest: null,
    sampleSequence: null,
    grantDigest: null,
    cleanupEvidenceCount: 0,
    status: "OPEN",
  });

type ReductionInput = Readonly<{
  readonly plan: RevealPartitionPlan;
  readonly state: RevealAggregatePartitionState;
  readonly receipt: RevealPartitionReceipt;
  readonly entry: RevealPartitionPlan["partitions"][number];
  readonly authorityKey: string;
}>;

const assertReceiptIdentity = (input: ReductionInput): void => {
  const { plan, state, receipt, entry } = input;
  const { partitionReceiptDigest: _digest, ...signedBody } = receipt;
  if (sha256Hex(signedBody) !== receipt.partitionReceiptDigest)
    throw new Error("Aggregate partition receipt digest drifted");
  const { boundaryAuthorityTag, ...body } = signedBody;
  assertPartitionBoundaryAuthority({
    authorityKey: input.authorityKey,
    body,
    authorityTag: boundaryAuthorityTag,
  });
  if (
    receipt.partitionPlanDigest !== plan.partitionPlanDigest ||
    receipt.partitionIndex !== state.nextPartitionIndex ||
    receipt.partitionId !== entry.partitionId ||
    receipt.predecessorPartitionDigest !== state.partitionHead ||
    receipt.startCandidateCount !== state.completedCandidateCount ||
    stableSerialize(receipt.startChain) !== stableSerialize(state.chain)
  )
    throw new Error(
      "Aggregate partition receipt predecessor or identity drifted",
    );
};

const assertReceiptBoundary = (input: ReductionInput): void => {
  const { state, receipt } = input;
  if (
    (state.attemptId !== null && receipt.attemptId !== state.attemptId) ||
    receipt.startChildOrdinal !== state.nextChildOrdinal ||
    receipt.startCheckpointDigest !== state.checkpointDigest ||
    receipt.startSampleSequence !== state.sampleSequence ||
    receipt.startGrantDigest !== state.grantDigest
  )
    throw new Error("Aggregate partition receipt boundary predecessor drifted");
};

const assertReceiptProgress = (input: ReductionInput): void => {
  const { state, receipt, entry } = input;
  const candidateDelta =
    receipt.endCandidateCount - receipt.startCandidateCount;
  if (
    receipt.endCandidateCount < receipt.startCandidateCount ||
    receipt.endCandidateCount > entry.maxEndCandidateCountExclusive ||
    candidateDelta < 1
  )
    throw new Error("Aggregate partition receipt does not close a valid range");
  assertPartitionChainProgress(state.chain, receipt.endChain);
  if (
    receipt.endCheckpointDigest.length === 0 ||
    (state.sampleSequence !== null &&
      receipt.endSampleSequence <= state.sampleSequence) ||
    (receipt.frontier === "non-empty" && receipt.endGrantDigest === null)
  )
    throw new Error("Aggregate partition receipt terminal boundary is invalid");
  assertPartitionCleanupEvidence({
    evidence: receipt.cleanupEvidence,
    startChildOrdinal: receipt.startChildOrdinal,
    endChildOrdinal: receipt.endChildOrdinal,
  });
  if (
    receipt.frontier === "empty" &&
    receipt.endCandidateCount === 0 &&
    state.nextPartitionIndex > 0
  )
    throw new Error("Only the initial empty frontier may have zero candidates");
};

export const reduceRevealPartitionReceipt = (input: {
  readonly plan: RevealPartitionPlan;
  readonly state: RevealAggregatePartitionState;
  readonly receipt: RevealPartitionReceipt;
  readonly authorityKey: string;
}): RevealAggregatePartitionState => {
  const { plan, state, receipt } = input;
  const entry = plan.partitions[state.nextPartitionIndex];
  if (entry === undefined)
    throw new Error("Aggregate partition plan has no next partition");
  const reductionInput = {
    plan,
    state,
    receipt,
    entry,
    authorityKey: input.authorityKey,
  };
  assertReceiptIdentity(reductionInput);
  assertReceiptBoundary(reductionInput);
  assertReceiptProgress(reductionInput);
  return {
    nextPartitionIndex: state.nextPartitionIndex + 1,
    completedCandidateCount: receipt.endCandidateCount,
    partitionHead: receipt.partitionReceiptDigest,
    chain: receipt.endChain,
    attemptId: state.attemptId ?? receipt.attemptId,
    nextChildOrdinal: receipt.endChildOrdinal + 1,
    checkpointDigest: receipt.endCheckpointDigest,
    sampleSequence: receipt.endSampleSequence,
    grantDigest: receipt.endGrantDigest,
    cleanupEvidenceCount:
      state.cleanupEvidenceCount + receipt.cleanupEvidence.length,
    status: receipt.frontier === "empty" ? "COMPLETE" : "OPEN",
  };
};

export const assertRevealAggregateComplete = (input: {
  readonly plan: RevealPartitionPlan;
  readonly state: RevealAggregatePartitionState;
}): void => {
  if (input.state.status !== "COMPLETE")
    throw new Error("Aggregate reveal partition state is not terminal");
  if (
    input.state.nextPartitionIndex < 1 ||
    input.state.nextPartitionIndex > input.plan.maxPartitions
  )
    throw new Error(
      "Aggregate reveal partition state has an invalid terminal index",
    );
  if (input.state.chain.receiptCount !== input.state.completedCandidateCount)
    throw new Error(
      "Aggregate reveal chain does not cover every terminal candidate",
    );
  if (input.state.cleanupEvidenceCount < 1)
    throw new Error("Aggregate reveal completion has no cleanup evidence");
};

export const createRevealAggregateCompletion = (input: {
  readonly plan: RevealPartitionPlan;
  readonly state: RevealAggregatePartitionState;
  readonly partitionReceiptDigests: readonly string[];
}): RevealAggregateCompletion => {
  assertRevealAggregateComplete(input);
  if (
    input.partitionReceiptDigests.length !== input.state.nextPartitionIndex ||
    input.state.partitionHead === null ||
    input.partitionReceiptDigests.at(-1) !== input.state.partitionHead
  )
    throw new Error(
      "Aggregate completion does not cover every partition receipt",
    );
  const body = aggregateCompletionBodySchema.parse({
    artifact: "PREFLIGHT_REVEAL_AGGREGATE_PARTITION_COMPLETE" as const,
    version: PREFLIGHT_REVEAL_AGGREGATE_PARTITION_VERSION,
    partitionPlanDigest: input.plan.partitionPlanDigest,
    status: "COMPLETE" as const,
    finalPartitionIndex: input.state.nextPartitionIndex - 1,
    completedCandidateCount: input.state.completedCandidateCount,
    finalChain: input.state.chain,
    partitionReceiptDigests: input.partitionReceiptDigests,
    cleanupEvidenceCount: input.state.cleanupEvidenceCount,
    cleanup: "PASS" as const,
    cleanupScope: PREFLIGHT_REVEAL_AGGREGATE_PARTITION_CLEANUP_SCOPE,
    completionScope: PREFLIGHT_REVEAL_AGGREGATE_COMPLETION_SCOPE,
  });
  return revealAggregateCompletionSchema.parse({
    ...body,
    aggregateCompletionDigest: sha256Hex(body),
  });
};

export const parseRevealAggregateCompletion = (
  value: unknown,
): RevealAggregateCompletion => {
  const parsed = revealAggregateCompletionSchema.parse(value);
  const { aggregateCompletionDigest: _digest, ...body } = parsed;
  if (sha256Hex(body) !== parsed.aggregateCompletionDigest)
    throw new Error("Aggregate completion digest drifted");
  return parsed;
};
