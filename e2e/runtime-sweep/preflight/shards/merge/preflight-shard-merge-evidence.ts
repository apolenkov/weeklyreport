import type { MatrixPreflightSegment } from "../../../matrix/finalization/matrix-finalizer-contract.ts";
import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { stableSerialize } from "../../../support/ids.ts";
import {
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
import { assertPreflightShardResourceProofMatchesSource } from "../resources/preflight-shard-resource-proof-validation.ts";
import {
  assertRequestContext,
  assertRequestCount,
} from "./preflight-shard-merge-assembly.ts";
import {
  type PreflightShardCompletionReadRequest,
  PreflightShardMergeError,
  type PreflightShardMergeReceiptShard,
} from "./preflight-shard-merge-contract.ts";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const readPersistedResourceProofs = async (input: {
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
  readonly donorRoots: readonly PreflightShardResourceProofDonorRoot[];
  readonly requests: readonly PreflightShardCompletionReadRequest[];
}): Promise<readonly PreflightShardResourceProof[]> => {
  assertRequestCount(input.assignment, input.requests);
  const proofs: PreflightShardResourceProof[] = [];
  for (const [requestIndex, request] of input.requests.entries()) {
    const expectedShard = input.assignment.shards[requestIndex];
    if (expectedShard === undefined)
      throw new PreflightShardMergeError(
        `Completion request ${requestIndex} has no assigned shard`,
      );
    assertRequestContext({
      source: input.source,
      assignment: input.assignment,
      expectedShard,
      request,
      requestIndex,
    });
    const proof = await (async (): Promise<PreflightShardResourceProof> => {
      try {
        return await readPreflightShardResourceProof(
          request.resourceProofPath,
          request.archiveRoot,
        );
      } catch (error: unknown) {
        throw new PreflightShardMergeError(
          `Durable resource proof read failed for shard ${expectedShard.logicalShardId}: ${errorMessage(error)}`,
        );
      }
    })();
    if (
      stableSerialize(proof) !== stableSerialize(request.context.resourceProof)
    )
      throw new PreflightShardMergeError(
        `Durable resource proof differs from the request context for shard ${expectedShard.logicalShardId}`,
      );
    try {
      assertPreflightShardResourceProofMatchesSource({
        source: input.source,
        assignment: input.assignment,
        proof,
        selectedShard: expectedShard,
      });
    } catch (error: unknown) {
      throw new PreflightShardMergeError(
        `Durable resource proof binding failed for shard ${expectedShard.logicalShardId}: ${errorMessage(error)}`,
      );
    }
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
      `Durable resource proof set is invalid: ${errorMessage(error)}`,
    );
  }
  return proofs;
};

const assertCompleteTerminalSegments = (input: {
  readonly shard: PreflightShard;
  readonly revalidated: RevalidatedPreflightShardCompletion;
  readonly proof: PreflightShardResourceProof;
  readonly source: SourceArtifact;
  readonly requestIndex: number;
}): ReadonlyMap<string, MatrixPreflightSegment> => {
  const expectedStateIds = input.shard.states.map(({ state }) => state.stateId);
  const expectedStateDigests = input.shard.states.map(
    ({ stateDigest }) => stateDigest,
  );
  const completion = input.revalidated.completion;
  if (
    stableSerialize(completion.assignedStateIds) !==
      stableSerialize(expectedStateIds) ||
    stableSerialize(completion.assignedStateDigests) !==
      stableSerialize(expectedStateDigests)
  )
    throw new PreflightShardMergeError(
      `Completion request ${input.requestIndex} assigned state identity drifted`,
    );
  const terminalPasses = input.revalidated.resume.terminalPasses;
  if (
    terminalPasses.size !== expectedStateIds.length ||
    stableSerialize([...terminalPasses.keys()]) !==
      stableSerialize(expectedStateIds)
  )
    throw new PreflightShardMergeError(
      `Completion request ${input.requestIndex} does not contain the complete ordered terminal state set`,
    );
  const evidenceByState = new Map(
    completion.stateEvidence.map((evidence) => [evidence.stateId, evidence]),
  );
  const segments = new Map<string, MatrixPreflightSegment>();
  input.shard.states.forEach((assignedState) => {
    const stateId = assignedState.state.stateId;
    const terminalPass = terminalPasses.get(stateId);
    const evidence = evidenceByState.get(stateId);
    if (terminalPass === undefined || evidence === undefined)
      throw new PreflightShardMergeError(
        `Completion request ${input.requestIndex} is incomplete for state ${stateId}`,
      );
    const sourceState = input.source.plan.states[assignedState.planIndex];
    if (
      sourceState === undefined ||
      stableSerialize(terminalPass.segment.state) !==
        stableSerialize(sourceState) ||
      terminalPass.receipt.segmentDigest !== evidence.segmentDigest
    )
      throw new PreflightShardMergeError(
        `Completion request ${input.requestIndex} terminal segment drifted for state ${stateId}`,
      );
    if (segments.has(stateId))
      throw new PreflightShardMergeError(
        `Completion request ${input.requestIndex} contains duplicate terminal state ${stateId}`,
      );
    segments.set(stateId, terminalPass.segment);
  });
  if (completion.resourceProofDigest !== input.proof.proofDigest)
    throw new PreflightShardMergeError(
      `Completion request ${input.requestIndex} resource proof identity drifted`,
    );
  return segments;
};

const completionReceiptShardFor = (input: {
  readonly context: PreflightShardJournalContext;
  readonly request: PreflightShardCompletionReadRequest;
  readonly proof: PreflightShardResourceProof;
  readonly completion: RevalidatedPreflightShardCompletion["completion"];
}): PreflightShardMergeReceiptShard => ({
  logicalShardId: input.context.shard.logicalShardId,
  shardIndex: input.context.shard.shardIndex,
  shardDigest: input.context.shard.shardDigest,
  donorId: input.proof.donorId,
  donorRoot: input.proof.donorRoot,
  shardAttemptId: input.proof.shardAttemptId,
  resourceProofPath: input.request.resourceProofPath,
  resourceProofDigest: input.proof.proofDigest,
  completionPath: input.request.filePath,
  completionDigest: input.completion.completionDigest,
  journalPath: input.request.journalPath,
  journalRecordCount: input.completion.journalRecordCount,
  journalTailDigest: input.completion.journalTailDigest,
  assignedStateIds: input.completion.assignedStateIds,
  assignedStateDigests: input.completion.assignedStateDigests,
});

export type PreflightShardEvidenceSnapshot = Readonly<{
  readonly proof: PreflightShardResourceProof;
  readonly completion: RevalidatedPreflightShardCompletion["completion"];
  readonly stateEvidence: readonly Readonly<{
    readonly stateId: string;
    readonly stateDigest: string;
    readonly segmentDigest: string;
    readonly segment: MatrixPreflightSegment;
  }>[];
}>;

type CollectedShardEvidence = Readonly<{
  readonly segments: ReadonlyMap<string, MatrixPreflightSegment>;
  readonly receiptShard: PreflightShardMergeReceiptShard;
  readonly snapshot: PreflightShardEvidenceSnapshot;
}>;

const readShardEvidence = async (input: {
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
  readonly expectedShard: PreflightShard;
  readonly request: PreflightShardCompletionReadRequest;
  readonly proof: PreflightShardResourceProof;
  readonly requestIndex: number;
}): Promise<CollectedShardEvidence> => {
  const durableContext: PreflightShardJournalContext = {
    ...input.request.context,
    resourceProof: input.proof,
  };
  const revalidated =
    await (async (): Promise<RevalidatedPreflightShardCompletion> => {
      try {
        return await readPreflightShardCompletion({
          ...input.request,
          context: durableContext,
        });
      } catch (error: unknown) {
        throw new PreflightShardMergeError(
          `Durable completion read failed for shard ${input.expectedShard.logicalShardId}: ${errorMessage(error)}`,
        );
      }
    })();
  const completion = revalidated.completion;
  if (
    completion.logicalShardId !== input.expectedShard.logicalShardId ||
    completion.shardIndex !== input.expectedShard.shardIndex ||
    completion.shardDigest !== input.expectedShard.shardDigest ||
    completion.assignmentDigest !== input.assignment.assignmentDigest
  )
    throw new PreflightShardMergeError(
      `Durable completion identity drifted for shard ${input.expectedShard.logicalShardId}`,
    );
  const segments = assertCompleteTerminalSegments({
    shard: input.expectedShard,
    revalidated,
    proof: input.proof,
    source: input.source,
    requestIndex: input.requestIndex,
  });
  const stateEvidence = completion.stateEvidence.map((evidence) => {
    const segment = segments.get(evidence.stateId);
    if (segment === undefined)
      throw new PreflightShardMergeError(
        `Completion request ${input.requestIndex} is missing segment evidence for ${evidence.stateId}`,
      );
    return { ...evidence, segment };
  });
  return {
    segments,
    receiptShard: completionReceiptShardFor({
      context: durableContext,
      request: input.request,
      proof: input.proof,
      completion,
    }),
    snapshot: { proof: input.proof, completion, stateEvidence },
  };
};

export const collectShardEvidence = async (input: {
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
  readonly donorRoots: readonly PreflightShardResourceProofDonorRoot[];
  readonly requests: readonly PreflightShardCompletionReadRequest[];
}): Promise<
  Readonly<{
    readonly segments: ReadonlyMap<string, MatrixPreflightSegment>;
    readonly receiptShards: readonly PreflightShardMergeReceiptShard[];
    readonly snapshots: readonly PreflightShardEvidenceSnapshot[];
  }>
> => {
  const proofs = await readPersistedResourceProofs(input);
  const segments = new Map<string, MatrixPreflightSegment>();
  const receiptShards: PreflightShardMergeReceiptShard[] = [];
  const snapshots: PreflightShardEvidenceSnapshot[] = [];
  for (const [requestIndex, request] of input.requests.entries()) {
    const expectedShard = input.assignment.shards[requestIndex];
    const proof = proofs[requestIndex];
    if (expectedShard === undefined || proof === undefined)
      throw new PreflightShardMergeError(
        `Completion request ${requestIndex} has no assigned shard`,
      );
    const evidence = await readShardEvidence({
      source: input.source,
      assignment: input.assignment,
      expectedShard,
      request,
      proof,
      requestIndex,
    });
    for (const [stateId, segment] of evidence.segments) {
      segments.set(stateId, segment);
    }
    receiptShards.push(evidence.receiptShard);
    snapshots.push(evidence.snapshot);
  }
  return { segments, receiptShards, snapshots };
};
