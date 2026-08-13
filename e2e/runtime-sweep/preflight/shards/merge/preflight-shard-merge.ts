import type { MatrixPreflightSegment } from "../../../matrix/finalization/matrix-finalizer-contract.ts";
import { freezeDeep } from "../../../source/manifest-source.ts";
import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { parseSourceArtifact } from "../../../source/source-artifact.ts";
import { sha256Hex } from "../../../support/ids.ts";
import {
  createPreflightArtifact,
  type PreflightArtifact,
} from "../../artifacts/preflight-artifact.ts";
import { attachSpecializedDeclarations } from "../../execution/playwright-preflight-support.ts";
import {
  assertPreflightShardAssignmentMatchesSource,
  parsePreflightShardAssignment,
} from "../preflight-shard-assignment.ts";
import {
  assertExactSourceStateUnion,
  collectShardEvidence,
} from "./preflight-shard-merge-assembly.ts";
import {
  parsePreflightShardMergeReceipt,
  PreflightShardMergeError,
  type PreflightShardMergeInput,
  type PreflightShardMergeReceipt,
  type PreflightShardMergeReceiptShard,
  type PreflightShardMergeResult,
} from "./preflight-shard-merge-contract.ts";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const createMergeReceipt = (input: {
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardMergeInput["assignment"];
  readonly preflightDigest: string;
  readonly shards: readonly PreflightShardMergeReceiptShard[];
}): PreflightShardMergeReceipt => {
  const body = {
    artifact: "PREFLIGHT_SHARD_MERGE_RECEIPT" as const,
    version: 1 as const,
    sourceSha: input.source.sourceSha,
    sourceTree: input.source.sourceTree,
    treeDigest: input.source.treeDigest,
    sourceDigest: input.source.sourceDigest,
    planDigest: input.source.plan.digest,
    assignmentDigest: input.assignment.assignmentDigest,
    shardCount: input.assignment.shardCount,
    shards: input.shards,
    preflightDigest: input.preflightDigest,
  } as const;
  return parsePreflightShardMergeReceipt({
    ...body,
    receiptDigest: sha256Hex(body),
  });
};

/**
 * Revalidates every durable shard completion and assembles one in-memory
 * preflight artifact. The caller cannot provide a completion value: the only
 * accepted evidence comes from readPreflightShardCompletion's journal,
 * receipt, and segment revalidation.
 */
export const mergePreflightShards = async (
  input: PreflightShardMergeInput,
): Promise<PreflightShardMergeResult> => {
  const source = (() => {
    try {
      return parseSourceArtifact(input.source);
    } catch (error: unknown) {
      throw new PreflightShardMergeError(
        `SOURCE.json is invalid for shard merge: ${errorMessage(error)}`,
      );
    }
  })();
  const assignment = (() => {
    try {
      return parsePreflightShardAssignment(input.assignment);
    } catch (error: unknown) {
      throw new PreflightShardMergeError(
        `PREFLIGHT_SHARD_ASSIGNMENT is invalid for shard merge: ${errorMessage(error)}`,
      );
    }
  })();
  assertPreflightShardAssignmentMatchesSource(source, assignment);
  const evidence = await collectShardEvidence({
    source,
    assignment,
    requests: input.completionRequests,
  });
  const orderedSegments: readonly MatrixPreflightSegment[] =
    assertExactSourceStateUnion({
      source,
      segments: evidence.segments,
    });
  const preflight: PreflightArtifact = createPreflightArtifact({
    source,
    segments: attachSpecializedDeclarations(source, orderedSegments),
  });
  const receipt = createMergeReceipt({
    source,
    assignment,
    preflightDigest: preflight.preflightDigest,
    shards: evidence.receiptShards,
  });
  return freezeDeep({ preflight, receipt });
};

export const mergePreflightShardCompletions = mergePreflightShards;

export type {
  PreflightShardCompletionReadRequest,
  PreflightShardMergeInput,
  PreflightShardMergeResult,
} from "./preflight-shard-merge-contract.ts";
