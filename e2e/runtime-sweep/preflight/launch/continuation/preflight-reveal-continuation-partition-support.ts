import {
  constantTimeEqualHex,
  hmacFor,
} from "../../reveal/continuation/preflight-reveal-continuation-digests.ts";
import type {
  RevealPartitionBoundaryBody,
  RevealPartitionChain,
  RevealPartitionCleanupEvidence,
} from "./preflight-reveal-continuation-partition-contract.ts";

const PARTITION_BOUNDARY_DOMAIN = "aggregate-partition-boundary";

export const partitionBoundaryAuthorityTagFor = (
  authorityKey: string,
  body: RevealPartitionBoundaryBody,
): string => hmacFor(authorityKey, PARTITION_BOUNDARY_DOMAIN, body);

export const assertPartitionBoundaryAuthority = (input: {
  readonly authorityKey: string;
  readonly body: RevealPartitionBoundaryBody;
  readonly authorityTag: string;
}): void => {
  const expected = partitionBoundaryAuthorityTagFor(
    input.authorityKey,
    input.body,
  );
  if (!constantTimeEqualHex(expected, input.authorityTag))
    throw new Error("Aggregate partition boundary authority tag drifted");
};

export const assertPartitionChainProgress = (
  previous: RevealPartitionChain,
  next: RevealPartitionChain,
): void => {
  const operationTotalKeys = [
    "fullReplayActions",
    "candidateActions",
    "inverseActions",
    "successfulRestorations",
    "consumedLeases",
    "physicalActions",
    "chargedActions",
  ] as const;
  if (
    next.receiptCount < previous.receiptCount ||
    next.chunkCount < previous.chunkCount ||
    next.operationChunkCount < previous.operationChunkCount ||
    operationTotalKeys.some(
      (key) => next.operationTotals[key] < previous.operationTotals[key],
    )
  )
    throw new Error("Aggregate partition chain regressed");
  if (
    (next.receiptCount === 0) !== (next.receiptHead === null) ||
    (next.chunkCount === 0) !== (next.chunkHead === null) ||
    (next.operationChunkCount === 0) !== (next.operationHead === null)
  )
    throw new Error("Aggregate partition chain head/count binding is invalid");
  if (
    next.receiptCount > previous.receiptCount &&
    next.receiptHead === previous.receiptHead
  )
    throw new Error("Aggregate partition receipt head did not advance");
  if (
    next.chunkCount > previous.chunkCount &&
    next.chunkHead === previous.chunkHead
  )
    throw new Error("Aggregate partition chunk head did not advance");
  if (
    next.operationChunkCount > previous.operationChunkCount &&
    next.operationHead === previous.operationHead
  )
    throw new Error("Aggregate partition operation head did not advance");
};

export const assertPartitionCleanupEvidence = (input: {
  readonly evidence: readonly RevealPartitionCleanupEvidence[];
  readonly startChildOrdinal: number;
  readonly endChildOrdinal: number;
}): void => {
  const expectedCount = input.endChildOrdinal - input.startChildOrdinal + 1;
  if (expectedCount < 1 || input.evidence.length !== expectedCount)
    throw new Error(
      "Aggregate partition cleanup evidence does not cover every child",
    );
  input.evidence.forEach((evidence, index) => {
    if (
      evidence.childOrdinal !== input.startChildOrdinal + index ||
      evidence.pgid !== evidence.pid
    )
      throw new Error(
        "Aggregate partition cleanup evidence is not owned and terminal",
      );
  });
};
