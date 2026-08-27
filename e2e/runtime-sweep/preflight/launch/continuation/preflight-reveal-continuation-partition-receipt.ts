import { sha256Hex } from "../../../support/ids.ts";
import type {
  RevealPartitionBoundaryBody,
  RevealPartitionChain,
  RevealPartitionPlan,
  RevealPartitionReceipt,
} from "./preflight-reveal-continuation-partition-contract.ts";
import {
  PREFLIGHT_REVEAL_AGGREGATE_PARTITION_CLEANUP_SCOPE,
  PREFLIGHT_REVEAL_AGGREGATE_PARTITION_VERSION,
} from "./preflight-reveal-continuation-partition-contract.ts";
import { revealPartitionReceiptSchema } from "./preflight-reveal-continuation-partition-contract.ts";
import type { RevealAggregatePartitionState } from "./preflight-reveal-continuation-partition-reducer.ts";
import {
  assertPartitionChainProgress,
  assertPartitionCleanupEvidence,
  partitionBoundaryAuthorityTagFor,
} from "./preflight-reveal-continuation-partition-support.ts";

type CreateReceiptInput = Readonly<{
  readonly plan: RevealPartitionPlan;
  readonly state: RevealAggregatePartitionState;
  readonly partitionIndex: number;
  readonly attemptId: string;
  readonly authorityKey: string;
  readonly startChildOrdinal: number;
  readonly endChildOrdinal: number;
  readonly endCandidateCount: number;
  readonly startCheckpointDigest: string | null;
  readonly endCheckpointDigest: string;
  readonly startSampleSequence: number | null;
  readonly endSampleSequence: number;
  readonly startGrantDigest: string | null;
  readonly endGrantDigest: string | null;
  readonly frontier: "non-empty" | "empty";
  readonly cleanupEvidence: RevealPartitionReceipt["cleanupEvidence"];
  readonly endChain: RevealPartitionChain;
}>;

type ReceiptPartitionEntry = RevealPartitionPlan["partitions"][number];

const assertReceiptIdentity = (
  input: CreateReceiptInput,
  entry: ReceiptPartitionEntry,
): void => {
  if (input.state.status !== "OPEN")
    throw new Error("Aggregate partition receipt cannot follow terminal state");
  if (input.state.nextPartitionIndex !== input.partitionIndex)
    throw new Error(
      "Aggregate partition receipt index is not the next partition",
    );
  if (
    input.state.completedCandidateCount >= entry.maxEndCandidateCountExclusive
  )
    throw new Error(
      "Aggregate partition receipt starts after its planned range",
    );
};

const assertReceiptRange = (
  input: CreateReceiptInput,
  entry: ReceiptPartitionEntry,
): void => {
  const candidateDelta =
    input.endCandidateCount - input.state.completedCandidateCount;
  if (
    input.endCandidateCount < input.state.completedCandidateCount ||
    input.endCandidateCount > entry.maxEndCandidateCountExclusive ||
    (input.frontier === "non-empty" &&
      candidateDelta < input.plan.partitionCandidateLimit)
  )
    throw new Error("Aggregate partition receipt candidate range is invalid");
};

const assertReceiptBoundary = (input: CreateReceiptInput): void => {
  if (
    input.state.attemptId !== null &&
    input.state.attemptId !== input.attemptId
  )
    throw new Error("Aggregate partition receipt attempt identity drifted");
  if (input.startChildOrdinal !== input.state.nextChildOrdinal)
    throw new Error("Aggregate partition receipt child boundary drifted");
  if (input.endChildOrdinal < input.startChildOrdinal)
    throw new Error("Aggregate partition receipt child range is invalid");
  if (input.startCheckpointDigest !== input.state.checkpointDigest)
    throw new Error(
      "Aggregate partition receipt checkpoint predecessor drifted",
    );
  if (input.startSampleSequence !== input.state.sampleSequence)
    throw new Error("Aggregate partition receipt sample predecessor drifted");
  if (input.startGrantDigest !== input.state.grantDigest)
    throw new Error("Aggregate partition receipt grant predecessor drifted");
};

const assertReceiptTerminalBoundary = (input: CreateReceiptInput): void => {
  if (input.endCheckpointDigest.length === 0)
    throw new Error("Aggregate partition receipt has no terminal checkpoint");
  if (input.endSampleSequence < 0)
    throw new Error("Aggregate partition receipt sample sequence is invalid");
  if (
    input.state.sampleSequence !== null &&
    input.endSampleSequence <= input.state.sampleSequence
  )
    throw new Error(
      "Aggregate partition receipt sample sequence did not advance",
    );
  if (input.frontier === "non-empty" && input.endGrantDigest === null)
    throw new Error(
      "A continuing partition must seal the next execution grant",
    );
  assertPartitionCleanupEvidence({
    evidence: input.cleanupEvidence,
    startChildOrdinal: input.startChildOrdinal,
    endChildOrdinal: input.endChildOrdinal,
  });
  assertPartitionChainProgress(input.state.chain, input.endChain);
};

export const createRevealPartitionReceipt = (
  input: CreateReceiptInput,
): RevealPartitionReceipt => {
  const entry = input.plan.partitions[input.partitionIndex];
  if (entry === undefined)
    throw new Error(
      "Aggregate partition receipt references an unknown partition",
    );
  assertReceiptIdentity(input, entry);
  assertReceiptRange(input, entry);
  assertReceiptBoundary(input);
  assertReceiptTerminalBoundary(input);
  const body: RevealPartitionBoundaryBody = {
    artifact: "PREFLIGHT_REVEAL_AGGREGATE_PARTITION_RECEIPT" as const,
    version: PREFLIGHT_REVEAL_AGGREGATE_PARTITION_VERSION,
    partitionPlanDigest: input.plan.partitionPlanDigest,
    partitionId: entry.partitionId,
    partitionIndex: entry.partitionIndex,
    predecessorPartitionDigest: input.state.partitionHead,
    attemptId: input.attemptId,
    startChildOrdinal: input.startChildOrdinal,
    endChildOrdinal: input.endChildOrdinal,
    startCandidateCount: input.state.completedCandidateCount,
    endCandidateCount: input.endCandidateCount,
    startCheckpointDigest: input.startCheckpointDigest,
    endCheckpointDigest: input.endCheckpointDigest,
    startSampleSequence: input.startSampleSequence,
    endSampleSequence: input.endSampleSequence,
    startGrantDigest: input.startGrantDigest,
    endGrantDigest: input.endGrantDigest,
    frontier: input.frontier,
    cleanup: "PASS" as const,
    cleanupScope: PREFLIGHT_REVEAL_AGGREGATE_PARTITION_CLEANUP_SCOPE,
    cleanupEvidence: input.cleanupEvidence,
    startChain: input.state.chain,
    endChain: input.endChain,
  };
  const boundaryAuthorityTag = partitionBoundaryAuthorityTagFor(
    input.authorityKey,
    body,
  );
  const signedBody = { ...body, boundaryAuthorityTag };
  return revealPartitionReceiptSchema.parse({
    ...signedBody,
    partitionReceiptDigest: sha256Hex(signedBody),
  });
};
