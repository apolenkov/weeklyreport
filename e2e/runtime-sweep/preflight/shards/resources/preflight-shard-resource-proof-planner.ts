import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import {
  assertPreflightShardAssignmentMatchesSource,
  type PreflightShard,
  type PreflightShardAssignment,
} from "../preflight-shard-assignment.ts";
import {
  PREFLIGHT_RESOURCE_COLLISION_SCOPE,
  PREFLIGHT_RESOURCE_REQUIRED_CONSENT,
  PREFLIGHT_RESOURCE_REQUIRED_GUARD,
  PREFLIGHT_RESOURCE_REQUIRED_REDIS_AUTHORIZATION,
  PREFLIGHT_SHARD_RESOURCE_PROOF,
  PREFLIGHT_SHARD_RESOURCE_PROOF_VERSION,
  type PreflightShardResourceProof,
  type PreflightShardResourceProofBody,
  type PreflightShardResourceProofBrowser,
  type PreflightShardResourceProofResources,
  type PreflightShardResourceProofRuntime,
} from "./preflight-shard-resource-proof-contract.ts";
import {
  PreflightShardResourcePlanError,
  type PreflightShardResourceProofDonorRoot as ResourceProofDonorRoot,
  validatePreflightShardResourceProofSet,
} from "./preflight-shard-resource-proof-set-validation.ts";
import {
  assertPreflightShardResourceProofMatchesSource,
  parsePreflightShardResourceProof,
} from "./preflight-shard-resource-proof-validation.ts";

export type CreatePreflightShardResourceProofInput = Readonly<{
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
  readonly shard: PreflightShard;
  readonly donorId: string;
  readonly donorRoot: string;
  readonly shardAttemptId: string;
  readonly browser: PreflightShardResourceProofBrowser;
  readonly runtime: PreflightShardResourceProofRuntime;
  readonly resources: PreflightShardResourceProofResources;
}>;

export type PreflightShardResourceProofPlanInput = Readonly<{
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
  readonly attempts: readonly Omit<
    CreatePreflightShardResourceProofInput,
    "source" | "assignment"
  >[];
  readonly donorRoots: readonly ResourceProofDonorRoot[];
}>;

export const createPreflightShardResourceProof = (
  input: CreatePreflightShardResourceProofInput,
): PreflightShardResourceProof => {
  assertPreflightShardAssignmentMatchesSource(input.source, input.assignment);
  const assignmentShard = input.assignment.shards.find(
    ({ logicalShardId }) => logicalShardId === input.shard.logicalShardId,
  );
  if (
    assignmentShard === undefined ||
    stableSerialize(assignmentShard) !== stableSerialize(input.shard)
  )
    throw new PreflightShardResourcePlanError(
      "Selected shard does not match the validated shard assignment",
    );
  const body: PreflightShardResourceProofBody = {
    artifact: PREFLIGHT_SHARD_RESOURCE_PROOF,
    version: PREFLIGHT_SHARD_RESOURCE_PROOF_VERSION,
    sourceSha: input.source.sourceSha,
    sourceTree: input.source.sourceTree,
    treeDigest: input.source.treeDigest,
    sourceDigest: input.source.sourceDigest,
    planDigest: input.source.plan.digest,
    assignmentDigest: input.assignment.assignmentDigest,
    logicalShardId: input.shard.logicalShardId,
    shardIndex: input.shard.shardIndex,
    shardDigest: input.shard.shardDigest,
    donorId: input.donorId,
    donorRoot: input.donorRoot,
    shardAttemptId: input.shardAttemptId,
    collisionScope: PREFLIGHT_RESOURCE_COLLISION_SCOPE,
    browser: input.browser,
    runtime: input.runtime,
    resources: input.resources,
    capabilities: {
      destructiveOperationsAllowed: false,
      requiredFutureGuard: PREFLIGHT_RESOURCE_REQUIRED_GUARD,
      requiredFutureConsent: PREFLIGHT_RESOURCE_REQUIRED_CONSENT,
      requiredFutureRedisAuthorization:
        PREFLIGHT_RESOURCE_REQUIRED_REDIS_AUTHORIZATION,
    },
  };
  const proof = parsePreflightShardResourceProof({
    ...body,
    proofDigest: sha256Hex(body),
  });
  assertPreflightShardResourceProofMatchesSource({
    source: input.source,
    assignment: input.assignment,
    proof,
    selectedShard: input.shard,
  });
  return proof;
};

export const planPreflightShardResourceProofs = (
  input: PreflightShardResourceProofPlanInput,
): readonly PreflightShardResourceProof[] => {
  const proofs = input.attempts.map((attempt) =>
    createPreflightShardResourceProof({
      ...attempt,
      source: input.source,
      assignment: input.assignment,
    }),
  );
  validatePreflightShardResourceProofSet(proofs, {
    source: input.source,
    assignment: input.assignment,
    donorRoots: input.donorRoots,
  });
  return proofs;
};
