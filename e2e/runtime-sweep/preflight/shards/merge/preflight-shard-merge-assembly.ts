import type { MatrixPreflightSegment } from "../../../matrix/finalization/matrix-finalizer-contract.ts";
import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { stableSerialize } from "../../../support/ids.ts";
import {
  preflightShardCompletionPathFor,
  readPreflightShardCompletion,
  type RevalidatedPreflightShardCompletion,
} from "../completion/preflight-shard-completion-io.ts";
import type { PreflightShardJournalContext } from "../journal/preflight-shard-journal-context.ts";
import { preflightShardJournalPathFor } from "../journal/preflight-shard-journal-io.ts";
import type {
  PreflightShard,
  PreflightShardAssignment,
} from "../preflight-shard-assignment.ts";
import { assertPreflightShardResourceProofMatchesSource } from "../resources/preflight-shard-resource-proof-validation.ts";
import {
  type PreflightShardCompletionReadRequest,
  PreflightShardMergeError,
  type PreflightShardMergeReceiptShard,
} from "./preflight-shard-merge-contract.ts";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const assertRequestCount = (
  assignment: PreflightShardAssignment,
  requests: readonly PreflightShardCompletionReadRequest[],
): void => {
  if (requests.length !== assignment.shardCount)
    throw new PreflightShardMergeError(
      `Expected one completion read request per assigned shard; received ${requests.length} for ${assignment.shardCount} shards`,
    );
};

export const assertRequestContext = (input: {
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
  readonly expectedShard: PreflightShard;
  readonly request: PreflightShardCompletionReadRequest;
  readonly requestIndex: number;
}): void => {
  const { request, expectedShard, requestIndex } = input;
  const { context } = request;
  if (stableSerialize(context.source) !== stableSerialize(input.source))
    throw new PreflightShardMergeError(
      `Completion request ${requestIndex} has a foreign SOURCE context`,
    );
  if (stableSerialize(context.assignment) !== stableSerialize(input.assignment))
    throw new PreflightShardMergeError(
      `Completion request ${requestIndex} has a foreign PREFLIGHT_SHARD_ASSIGNMENT context`,
    );
  if (stableSerialize(context.shard) !== stableSerialize(expectedShard))
    throw new PreflightShardMergeError(
      `Completion request ${requestIndex} shard is missing, extra, duplicate, or reordered`,
    );
  assertPreflightShardResourceProofMatchesSource({
    source: input.source,
    assignment: input.assignment,
    proof: context.resourceProof,
    selectedShard: expectedShard,
  });
  if (
    request.archiveRoot !== context.resourceProof.resources.archiveRoot ||
    request.filePath !== preflightShardCompletionPathFor(context) ||
    request.journalPath !== preflightShardJournalPathFor(context)
  )
    throw new PreflightShardMergeError(
      `Completion request ${requestIndex} has a forged archive, completion, or journal path`,
    );
};

const assertCompleteTerminalSegments = (input: {
  readonly shard: PreflightShard;
  readonly revalidated: RevalidatedPreflightShardCompletion;
  readonly source: SourceArtifact;
  readonly requestIndex: number;
}): ReadonlyMap<string, MatrixPreflightSegment> => {
  const expectedStateIds = input.shard.states.map(({ state }) => state.stateId);
  const terminalPasses = input.revalidated.resume.terminalPasses;
  if (
    terminalPasses.size !== expectedStateIds.length ||
    stableSerialize([...terminalPasses.keys()]) !==
      stableSerialize(expectedStateIds)
  )
    throw new PreflightShardMergeError(
      `Completion request ${input.requestIndex} does not contain the complete ordered terminal state set`,
    );
  const segments = new Map<string, MatrixPreflightSegment>();
  input.shard.states.forEach((assignedState) => {
    const stateId = assignedState.state.stateId;
    const terminalPass = terminalPasses.get(stateId);
    if (terminalPass === undefined)
      throw new PreflightShardMergeError(
        `Completion request ${input.requestIndex} is incomplete for state ${stateId}`,
      );
    const sourceState = input.source.plan.states[assignedState.planIndex];
    if (
      sourceState === undefined ||
      stableSerialize(terminalPass.segment.state) !==
        stableSerialize(sourceState)
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
  return segments;
};

const completionReceiptShardFor = (input: {
  readonly context: PreflightShardJournalContext;
  readonly request: PreflightShardCompletionReadRequest;
  readonly completion: RevalidatedPreflightShardCompletion["completion"];
}): PreflightShardMergeReceiptShard => ({
  logicalShardId: input.context.shard.logicalShardId,
  shardIndex: input.context.shard.shardIndex,
  shardDigest: input.context.shard.shardDigest,
  shardAttemptId: input.context.resourceProof.shardAttemptId,
  resourceProofDigest: input.context.resourceProof.proofDigest,
  completionPath: input.request.filePath,
  completionDigest: input.completion.completionDigest,
  journalPath: input.request.journalPath,
  journalRecordCount: input.completion.journalRecordCount,
  journalTailDigest: input.completion.journalTailDigest,
  assignedStateIds: input.completion.assignedStateIds,
  assignedStateDigests: input.completion.assignedStateDigests,
});

type CollectedShardEvidence = Readonly<{
  readonly segments: ReadonlyMap<string, MatrixPreflightSegment>;
  readonly receiptShard: PreflightShardMergeReceiptShard;
}>;

const readDurableCompletion = async (input: {
  readonly request: PreflightShardCompletionReadRequest;
  readonly shard: PreflightShard;
}): Promise<RevalidatedPreflightShardCompletion> => {
  try {
    return await readPreflightShardCompletion(input.request);
  } catch (error: unknown) {
    throw new PreflightShardMergeError(
      `Durable completion read failed for shard ${input.shard.logicalShardId}: ${errorMessage(error)}`,
    );
  }
};

const readShardEvidence = async (input: {
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
  readonly expectedShard: PreflightShard;
  readonly request: PreflightShardCompletionReadRequest;
  readonly requestIndex: number;
}): Promise<CollectedShardEvidence> => {
  assertRequestContext(input);
  const revalidated = await readDurableCompletion({
    request: input.request,
    shard: input.expectedShard,
  });
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
  return {
    segments: assertCompleteTerminalSegments({
      shard: input.expectedShard,
      revalidated,
      source: input.source,
      requestIndex: input.requestIndex,
    }),
    receiptShard: completionReceiptShardFor({
      context: input.request.context,
      request: input.request,
      completion,
    }),
  };
};

export const collectShardEvidence = async (input: {
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
  readonly requests: readonly PreflightShardCompletionReadRequest[];
}): Promise<
  Readonly<{
    readonly segments: ReadonlyMap<string, MatrixPreflightSegment>;
    readonly receiptShards: readonly PreflightShardMergeReceiptShard[];
  }>
> => {
  assertRequestCount(input.assignment, input.requests);
  const segments = new Map<string, MatrixPreflightSegment>();
  const receiptShards: PreflightShardMergeReceiptShard[] = [];
  for (const [requestIndex, request] of input.requests.entries()) {
    const expectedShard = input.assignment.shards[requestIndex];
    if (expectedShard === undefined)
      throw new PreflightShardMergeError(
        `Completion request ${requestIndex} has no assigned shard`,
      );
    const evidence = await readShardEvidence({
      source: input.source,
      assignment: input.assignment,
      expectedShard,
      request,
      requestIndex,
    });
    for (const [stateId, segment] of evidence.segments) {
      if (segments.has(stateId))
        throw new PreflightShardMergeError(
          `Merged shard segments contain duplicate source state ${stateId}`,
        );
      segments.set(stateId, segment);
    }
    receiptShards.push(evidence.receiptShard);
  }
  return { segments, receiptShards };
};

export const assertExactSourceStateUnion = (input: {
  readonly source: SourceArtifact;
  readonly segments: ReadonlyMap<string, MatrixPreflightSegment>;
}): readonly MatrixPreflightSegment[] => {
  const expectedStateIds = input.source.plan.states.map(
    ({ stateId }) => stateId,
  );
  if (input.segments.size !== expectedStateIds.length)
    throw new PreflightShardMergeError(
      "Merged shard segments do not cover the source state plan exactly once",
    );
  const ordered = expectedStateIds.map((stateId) => {
    const segment = input.segments.get(stateId);
    if (segment === undefined)
      throw new PreflightShardMergeError(
        `Merged shard segments are missing source state ${stateId}`,
      );
    if (segment.state.stateId !== stateId)
      throw new PreflightShardMergeError(
        `Merged shard segment order drifted at source state ${stateId}`,
      );
    return segment;
  });
  if (
    new Set(ordered.map(({ state }) => state.stateId)).size !== ordered.length
  )
    throw new PreflightShardMergeError(
      "Merged shard segments contain a duplicate source state",
    );
  return ordered;
};
