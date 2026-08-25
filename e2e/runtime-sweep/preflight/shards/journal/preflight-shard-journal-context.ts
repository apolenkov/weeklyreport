import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { stableSerialize } from "../../../support/ids.ts";
import {
  assertPreflightShardAssignmentMatchesSource,
  type PreflightShard,
  type PreflightShardAssignment,
} from "../preflight-shard-assignment.ts";
import type { PreflightShardResourceProof } from "../resources/preflight-shard-resource-proof-contract.ts";
import { assertPreflightShardResourceProofMatchesSource } from "../resources/preflight-shard-resource-proof-validation.ts";
import {
  PreflightShardJournalError,
  type PreflightShardJournalIdentity,
  preflightShardJournalIdentitySchema,
} from "./preflight-shard-journal-contract.ts";

export type PreflightShardJournalContext = Readonly<{
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
  readonly shard: PreflightShard;
  readonly resourceProof: PreflightShardResourceProof;
}>;

export const assertPreflightShardJournalContext = (
  context: PreflightShardJournalContext,
): PreflightShardJournalIdentity => {
  assertPreflightShardAssignmentMatchesSource(
    context.source,
    context.assignment,
  );
  const assignedShard = context.assignment.shards.find(
    ({ logicalShardId }) => logicalShardId === context.shard.logicalShardId,
  );
  if (
    assignedShard === undefined ||
    stableSerialize(assignedShard) !== stableSerialize(context.shard)
  )
    throw new PreflightShardJournalError(
      "Selected shard does not exactly match PREFLIGHT_SHARD_ASSIGNMENT",
    );
  assertPreflightShardResourceProofMatchesSource({
    source: context.source,
    assignment: context.assignment,
    proof: context.resourceProof,
    selectedShard: assignedShard,
  });
  return preflightShardJournalIdentitySchema.parse({
    sourceSha: context.source.sourceSha,
    sourceTree: context.source.sourceTree,
    treeDigest: context.source.treeDigest,
    sourceDigest: context.source.sourceDigest,
    planDigest: context.source.plan.digest,
    assignmentDigest: context.assignment.assignmentDigest,
    logicalShardId: assignedShard.logicalShardId,
    shardIndex: assignedShard.shardIndex,
    shardCount: context.assignment.shardCount,
    shardDigest: assignedShard.shardDigest,
    donorId: context.resourceProof.donorId,
    shardAttemptId: context.resourceProof.shardAttemptId,
    resourceProofDigest: context.resourceProof.proofDigest,
  });
};
