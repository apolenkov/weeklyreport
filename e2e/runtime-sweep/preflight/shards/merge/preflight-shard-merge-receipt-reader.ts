import * as path from "node:path";

import { freezeDeep } from "../../../source/manifest-source.ts";
import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { stableSerialize } from "../../../support/ids.ts";
import type { PreflightArtifact } from "../../artifacts/preflight-artifact.ts";
import {
  preflightShardCompletionPathFor,
  readPreflightShardCompletion,
  type RevalidatedPreflightShardCompletion,
} from "../completion/preflight-shard-completion-io.ts";
import type { PreflightShardJournalContext } from "../journal/preflight-shard-journal-context.ts";
import type {
  PreflightShard,
  PreflightShardAssignment,
} from "../preflight-shard-assignment.ts";
import type { PreflightShardResourceProof } from "../resources/preflight-shard-resource-proof-contract.ts";
import { readPreflightShardResourceProof } from "../resources/preflight-shard-resource-proof-io.ts";
import {
  type PreflightShardResourceProofDonorRoot,
  validatePreflightShardResourceProofSet,
} from "../resources/preflight-shard-resource-proof-set-validation.ts";
import {
  assertPreflightShardResourceProofFilesystem,
  assertPreflightShardResourceProofMatchesSource,
} from "../resources/preflight-shard-resource-proof-validation.ts";
import { preflightShardResourceProofPathFor } from "./preflight-shard-merge-assembly.ts";
import {
  assertPreflightShardMergeReceiptMatchesSource,
  parsePreflightShardMergeReceipt,
  PreflightShardMergeError,
  type PreflightShardMergeReceipt,
} from "./preflight-shard-merge-contract.ts";

const equal = (left: unknown, right: unknown): boolean =>
  stableSerialize(left) === stableSerialize(right);

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const canonicalAttemptSuffix = (
  shardId: string,
  attemptId: string,
  fileName: string,
): string => path.join("shards", shardId, "attempts", attemptId, fileName);

const archiveRootForReceiptShard = (
  shard: PreflightShardMergeReceipt["shards"][number],
): string => {
  const suffix = `/${canonicalAttemptSuffix(
    shard.logicalShardId,
    shard.shardAttemptId,
    "PREFLIGHT_SHARD_RESOURCE_PROOF.json",
  )}`;
  if (!shard.resourceProofPath.endsWith(suffix))
    throw new PreflightShardMergeError(
      `PREFLIGHT_SHARD_MERGE_RECEIPT resource proof path is not canonical for ${shard.logicalShardId}`,
    );
  const archiveRoot = shard.resourceProofPath.slice(0, -suffix.length);
  if (
    archiveRoot.length === 0 ||
    path.resolve(archiveRoot) !== archiveRoot ||
    archiveRoot === path.parse(archiveRoot).root
  )
    throw new PreflightShardMergeError(
      `PREFLIGHT_SHARD_MERGE_RECEIPT resource proof archive root is not canonical for ${shard.logicalShardId}`,
    );
  return archiveRoot;
};

const readPersistedProof = async (input: {
  readonly shard: PreflightShardMergeReceipt["shards"][number];
  readonly archiveRoot: string;
}): Promise<PreflightShardResourceProof> => {
  try {
    const proof = await readPreflightShardResourceProof(
      input.shard.resourceProofPath,
      input.archiveRoot,
    );
    await assertPreflightShardResourceProofFilesystem(proof);
    return proof;
  } catch (error: unknown) {
    throw new PreflightShardMergeError(
      `Durable merge receipt resource proof read failed for ${input.shard.logicalShardId}: ${errorMessage(error)}`,
    );
  }
};

const assertPersistedProofBinding = (input: {
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
  readonly expectedShard: PreflightShard;
  readonly receiptShard: PreflightShardMergeReceipt["shards"][number];
  readonly proof: PreflightShardResourceProof;
  readonly archiveRoot: string;
}): void => {
  const { proof, receiptShard } = input;
  if (
    proof.donorId !== receiptShard.donorId ||
    proof.donorRoot !== receiptShard.donorRoot ||
    proof.logicalShardId !== receiptShard.logicalShardId ||
    proof.shardAttemptId !== receiptShard.shardAttemptId ||
    proof.proofDigest !== receiptShard.resourceProofDigest ||
    proof.shardIndex !== receiptShard.shardIndex ||
    proof.shardDigest !== receiptShard.shardDigest ||
    proof.resources.archiveRoot !== input.archiveRoot
  )
    throw new PreflightShardMergeError(
      `Durable merge receipt resource proof identity drifted for ${receiptShard.logicalShardId}`,
    );
  try {
    assertPreflightShardResourceProofMatchesSource({
      source: input.source,
      assignment: input.assignment,
      proof,
      selectedShard: input.expectedShard,
    });
  } catch (error: unknown) {
    throw new PreflightShardMergeError(
      `Durable merge receipt resource proof binding failed for ${receiptShard.logicalShardId}: ${errorMessage(error)}`,
    );
  }
};

const contextFor = (input: {
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
  readonly expectedShard: PreflightShard;
  readonly receiptShard: PreflightShardMergeReceipt["shards"][number];
  readonly proof: PreflightShardResourceProof;
}): PreflightShardJournalContext => {
  const context: PreflightShardJournalContext = {
    source: input.source,
    assignment: input.assignment,
    shard: input.expectedShard,
    resourceProof: input.proof,
  };
  if (
    input.receiptShard.resourceProofPath !==
      preflightShardResourceProofPathFor(context) ||
    input.receiptShard.completionPath !==
      preflightShardCompletionPathFor(context)
  )
    throw new PreflightShardMergeError(
      `Durable merge receipt paths are not the exact persisted paths for ${input.receiptShard.logicalShardId}`,
    );
  return context;
};

const assertCompletionBinding = (input: {
  readonly context: PreflightShardJournalContext;
  readonly receiptShard: PreflightShardMergeReceipt["shards"][number];
  readonly revalidated: RevalidatedPreflightShardCompletion;
  readonly archiveRoot: string;
}): void => {
  const completion = input.revalidated.completion;
  const expectedStateIds = input.context.shard.states.map(
    ({ state }) => state.stateId,
  );
  const expectedStateDigests = input.context.shard.states.map(
    ({ stateDigest }) => stateDigest,
  );
  const stateEvidenceIds = completion.stateEvidence.map(
    ({ stateId }) => stateId,
  );
  const stateEvidenceDigests = completion.stateEvidence.map(
    ({ stateDigest }) => stateDigest,
  );
  if (
    completion.logicalShardId !== input.receiptShard.logicalShardId ||
    completion.shardIndex !== input.receiptShard.shardIndex ||
    completion.shardDigest !== input.receiptShard.shardDigest ||
    completion.assignmentDigest !== input.context.assignment.assignmentDigest ||
    completion.resourceProofDigest !== input.receiptShard.resourceProofDigest ||
    completion.archiveRoot !== input.archiveRoot ||
    completion.journalPath !== input.receiptShard.journalPath ||
    completion.journalRecordCount !== input.receiptShard.journalRecordCount ||
    completion.journalTailDigest !== input.receiptShard.journalTailDigest ||
    completion.completionDigest !== input.receiptShard.completionDigest ||
    !equal(completion.assignedStateIds, input.receiptShard.assignedStateIds) ||
    !equal(
      completion.assignedStateDigests,
      input.receiptShard.assignedStateDigests,
    ) ||
    !equal(completion.assignedStateIds, expectedStateIds) ||
    !equal(completion.assignedStateDigests, expectedStateDigests) ||
    !equal(stateEvidenceIds, expectedStateIds) ||
    !equal(stateEvidenceDigests, expectedStateDigests)
  )
    throw new PreflightShardMergeError(
      `Durable merge receipt completion, journal, or ordered state binding drifted for ${input.receiptShard.logicalShardId}`,
    );
  // readPreflightShardCompletion already revalidated every state receipt and
  // segment path/digest against this context's journal and source.
};

const readPersistedCompletion = async (input: {
  readonly context: PreflightShardJournalContext;
  readonly receiptShard: PreflightShardMergeReceipt["shards"][number];
  readonly archiveRoot: string;
}): Promise<RevalidatedPreflightShardCompletion> => {
  try {
    return await readPreflightShardCompletion({
      context: input.context,
      archiveRoot: input.archiveRoot,
      filePath: input.receiptShard.completionPath,
      journalPath: input.receiptShard.journalPath,
    });
  } catch (error: unknown) {
    throw new PreflightShardMergeError(
      `Durable merge receipt completion read failed for ${input.receiptShard.logicalShardId}: ${errorMessage(error)}`,
    );
  }
};

/** Revalidates a receipt against persisted proof, completion, journal, and state evidence. */
export const readPreflightShardMergeReceipt = async (input: {
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
  readonly preflight: PreflightArtifact;
  readonly receipt: PreflightShardMergeReceipt;
  readonly donorRoots: readonly PreflightShardResourceProofDonorRoot[];
}): Promise<PreflightShardMergeReceipt> => {
  const receipt = parsePreflightShardMergeReceipt(input.receipt);
  assertPreflightShardMergeReceiptMatchesSource({
    source: input.source,
    assignment: input.assignment,
    donorRoots: input.donorRoots,
    preflight: input.preflight,
    receipt,
  });
  const proofs: PreflightShardResourceProof[] = [];
  for (const [receiptIndex, receiptShard] of receipt.shards.entries()) {
    const expectedShard = input.assignment.shards[receiptIndex];
    if (expectedShard === undefined)
      throw new PreflightShardMergeError(
        `Merge receipt references a shard outside the assignment at index ${receiptIndex}`,
      );
    const archiveRoot = archiveRootForReceiptShard(receiptShard);
    const proof = await readPersistedProof({
      shard: receiptShard,
      archiveRoot,
    });
    assertPersistedProofBinding({
      source: input.source,
      assignment: input.assignment,
      expectedShard,
      receiptShard,
      proof,
      archiveRoot,
    });
    const context = contextFor({
      source: input.source,
      assignment: input.assignment,
      expectedShard,
      receiptShard,
      proof,
    });
    const revalidated = await readPersistedCompletion({
      context,
      receiptShard,
      archiveRoot,
    });
    assertCompletionBinding({
      context,
      receiptShard,
      revalidated,
      archiveRoot,
    });
    proofs.push(proof);
  }
  try {
    validatePreflightShardResourceProofSet(proofs, {
      donorRoots: input.donorRoots,
      source: input.source,
      assignment: input.assignment,
    });
  } catch (error: unknown) {
    throw new PreflightShardMergeError(
      `Durable merge receipt proof set is invalid: ${errorMessage(error)}`,
    );
  }
  return freezeDeep(receipt);
};

export const validatePreflightShardMergeReceipt =
  readPreflightShardMergeReceipt;
