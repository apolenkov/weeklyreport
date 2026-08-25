import * as path from "node:path";

import type { MatrixPreflightSegment } from "../../../matrix/finalization/matrix-finalizer-contract.ts";
import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { stableSerialize } from "../../../support/ids.ts";
import { preflightShardCompletionPathFor } from "../completion/preflight-shard-completion-io.ts";
import type { PreflightShardJournalContext } from "../journal/preflight-shard-journal-context.ts";
import { preflightShardJournalPathFor } from "../journal/preflight-shard-journal-io.ts";
import type {
  PreflightShard,
  PreflightShardAssignment,
} from "../preflight-shard-assignment.ts";
import {
  type PreflightShardCompletionReadRequest,
  PreflightShardMergeError,
} from "./preflight-shard-merge-contract.ts";

/** The only accepted persisted proof location for a shard completion request. */
export const preflightShardResourceProofPathFor = (
  context: PreflightShardJournalContext,
): string =>
  path.join(
    context.resourceProof.resources.archiveRoot,
    "shards",
    context.shard.logicalShardId,
    "attempts",
    context.resourceProof.shardAttemptId,
    "PREFLIGHT_SHARD_RESOURCE_PROOF.json",
  );

export const assertRequestCount = (
  assignment: PreflightShardAssignment,
  requests: readonly PreflightShardCompletionReadRequest[],
): void => {
  if (requests.length !== assignment.shardCount)
    throw new PreflightShardMergeError(
      `Expected one completion read request per assigned shard; received ${requests.length} for ${assignment.shardCount} shards`,
    );
};

/** Checks caller identity and exact durable paths before any completion read. */
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
  if (
    request.archiveRoot !== context.resourceProof.resources.archiveRoot ||
    request.resourceProofPath !== preflightShardResourceProofPathFor(context) ||
    request.filePath !== preflightShardCompletionPathFor(context) ||
    request.journalPath !== preflightShardJournalPathFor(context)
  )
    throw new PreflightShardMergeError(
      `Completion request ${requestIndex} has a forged archive, completion, or journal path (including resource proof path)`,
    );
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
