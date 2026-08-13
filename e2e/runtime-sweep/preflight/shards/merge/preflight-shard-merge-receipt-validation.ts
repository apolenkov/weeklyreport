import * as path from "node:path";

import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { stableSerialize } from "../../../support/ids.ts";
import {
  assertPreflightMatchesSource,
  type PreflightArtifact,
} from "../../artifacts/preflight-artifact.ts";
import {
  assertPreflightShardAssignmentMatchesSource,
  type PreflightShardAssignment,
} from "../preflight-shard-assignment.ts";
import type { PreflightShardResourceProofDonorRoot } from "../resources/preflight-shard-resource-proof-set-validation.ts";
import {
  parsePreflightShardMergeReceipt,
  PreflightShardMergeError,
  type PreflightShardMergeReceipt,
} from "./preflight-shard-merge-contract.ts";
import { assertReceiptShardStateUnion } from "./preflight-shard-merge-receipt-state-validation.ts";

const equal = (left: unknown, right: unknown): boolean =>
  stableSerialize(left) === stableSerialize(right);

const assertUnique = (values: readonly string[], label: string): void => {
  if (new Set(values).size !== values.length)
    throw new PreflightShardMergeError(
      `PREFLIGHT_SHARD_MERGE_RECEIPT contains duplicate ${label}`,
    );
};

const isDescendantPath = (root: string, candidate: string): boolean => {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return (
    relative.length > 0 &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
};

const canonicalAttemptSuffix = (
  shardId: string,
  attemptId: string,
  fileName: string,
): string => path.join("shards", shardId, "attempts", attemptId, fileName);

const assertReceiptSourceIdentity = (input: {
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
  readonly preflight: PreflightArtifact;
  readonly receipt: PreflightShardMergeReceipt;
}): void => {
  try {
    assertPreflightShardAssignmentMatchesSource(input.source, input.assignment);
    assertPreflightMatchesSource(input.source, input.preflight);
  } catch (error: unknown) {
    throw new PreflightShardMergeError(
      `Merge receipt source binding failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  const sourceIdentity = {
    sourceSha: input.source.sourceSha,
    sourceTree: input.source.sourceTree,
    treeDigest: input.source.treeDigest,
    sourceDigest: input.source.sourceDigest,
    planDigest: input.source.plan.digest,
  } as const;
  const receiptIdentity = {
    sourceSha: input.receipt.sourceSha,
    sourceTree: input.receipt.sourceTree,
    treeDigest: input.receipt.treeDigest,
    sourceDigest: input.receipt.sourceDigest,
    planDigest: input.receipt.planDigest,
  } as const;
  if (!equal(receiptIdentity, sourceIdentity))
    throw new PreflightShardMergeError(
      "PREFLIGHT_SHARD_MERGE_RECEIPT source identity does not match SOURCE.json",
    );
  if (input.receipt.assignmentDigest !== input.assignment.assignmentDigest)
    throw new PreflightShardMergeError(
      "PREFLIGHT_SHARD_MERGE_RECEIPT assignment digest does not match PREFLIGHT_SHARD_ASSIGNMENT",
    );
  if (
    input.receipt.shardCount !== input.assignment.shardCount ||
    input.receipt.shards.length !== input.assignment.shards.length
  )
    throw new PreflightShardMergeError(
      "PREFLIGHT_SHARD_MERGE_RECEIPT shard count does not match the assignment",
    );
  if (input.receipt.preflightDigest !== input.preflight.preflightDigest)
    throw new PreflightShardMergeError(
      "PREFLIGHT_SHARD_MERGE_RECEIPT does not bind the generated PREFLIGHT artifact",
    );
};

const assertReceiptShardIdentities = (
  receipt: PreflightShardMergeReceipt,
): void => {
  assertUnique(
    receipt.shards.map(({ logicalShardId }) => logicalShardId),
    "shard identity",
  );
  assertUnique(
    receipt.shards.map(({ donorId, logicalShardId, shardAttemptId }) =>
      [donorId, logicalShardId, shardAttemptId].join("\u0000"),
    ),
    "donor-local shard attempt identity",
  );
  assertUnique(
    receipt.shards.map(({ resourceProofDigest }) => resourceProofDigest),
    "resource proof identity",
  );
  assertUnique(
    receipt.shards.map(({ resourceProofPath }) => resourceProofPath),
    "resource proof path",
  );
  assertUnique(
    receipt.shards.map(({ completionDigest }) => completionDigest),
    "completion identity",
  );
  assertUnique(
    receipt.shards.map(({ completionPath }) => completionPath),
    "completion path",
  );
  assertUnique(
    receipt.shards.map(({ journalTailDigest }) => journalTailDigest),
    "journal identity",
  );
  assertUnique(
    receipt.shards.map(({ journalPath }) => journalPath),
    "journal path",
  );
};

const assertReceiptShardPath = (input: {
  readonly shard: PreflightShardMergeReceipt["shards"][number];
  readonly donorRoots: readonly PreflightShardResourceProofDonorRoot[];
}): void => {
  const donorRoot = input.donorRoots.find(
    ({ donorId }) => donorId === input.shard.donorId,
  )?.root;
  const shard = input.shard;
  if (donorRoot !== shard.donorRoot)
    throw new PreflightShardMergeError(
      `PREFLIGHT_SHARD_MERGE_RECEIPT donor root is not the canonical supplied root for ${shard.donorId}`,
    );
  const proofPathSuffix = canonicalAttemptSuffix(
    shard.logicalShardId,
    shard.shardAttemptId,
    "PREFLIGHT_SHARD_RESOURCE_PROOF.json",
  );
  const completionPathSuffix = canonicalAttemptSuffix(
    shard.logicalShardId,
    shard.shardAttemptId,
    "SHARD_COMPLETE.json",
  );
  const journalPathSuffix = canonicalAttemptSuffix(
    shard.logicalShardId,
    shard.shardAttemptId,
    "PREFLIGHT_SHARD.journal.jsonl",
  );
  if (
    !isDescendantPath(shard.donorRoot, shard.resourceProofPath) ||
    !isDescendantPath(shard.donorRoot, shard.completionPath) ||
    !isDescendantPath(shard.donorRoot, shard.journalPath) ||
    !shard.resourceProofPath.endsWith(proofPathSuffix) ||
    !shard.completionPath.endsWith(completionPathSuffix) ||
    !shard.journalPath.endsWith(journalPathSuffix)
  )
    throw new PreflightShardMergeError(
      `PREFLIGHT_SHARD_MERGE_RECEIPT durable paths are not canonical for shard ${shard.logicalShardId}`,
    );
};

const assertReceiptShardPathsAndIdentities = (input: {
  readonly receipt: PreflightShardMergeReceipt;
  readonly donorRoots: readonly PreflightShardResourceProofDonorRoot[];
}): void => {
  assertReceiptShardIdentities(input.receipt);
  input.receipt.shards.forEach((shard) =>
    assertReceiptShardPath({ shard, donorRoots: input.donorRoots }),
  );
};

/** Source/assignment-aware receipt assertion; parser-only validation is insufficient. */
export const assertPreflightShardMergeReceiptMatchesSource = (input: {
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
  readonly donorRoots: readonly PreflightShardResourceProofDonorRoot[];
  readonly preflight: PreflightArtifact;
  readonly receipt: PreflightShardMergeReceipt;
}): void => {
  const receipt = parsePreflightShardMergeReceipt(input.receipt);
  assertReceiptSourceIdentity({ ...input, receipt });
  assertReceiptShardPathsAndIdentities({
    receipt,
    donorRoots: input.donorRoots,
  });
  assertReceiptShardStateUnion({
    source: input.source,
    assignment: input.assignment,
    receipt,
  });
};
