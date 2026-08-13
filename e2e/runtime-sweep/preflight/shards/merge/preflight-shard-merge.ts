import type { MatrixPreflightSegment } from "../../../matrix/finalization/matrix-finalizer-contract.ts";
import { freezeDeep } from "../../../source/manifest-source.ts";
import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { parseSourceArtifact } from "../../../source/source-artifact.ts";
import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import {
  createPreflightArtifact,
  type PreflightArtifact,
} from "../../artifacts/preflight-artifact.ts";
import { attachSpecializedDeclarations } from "../../execution/playwright-preflight-support.ts";
import {
  assertPreflightShardAssignmentMatchesSource,
  parsePreflightShardAssignment,
} from "../preflight-shard-assignment.ts";
import { assertExactSourceStateUnion } from "./preflight-shard-merge-assembly.ts";
import {
  assertPreflightShardMergeReceiptMatchesSource,
  parsePreflightShardMergeReceipt,
  PreflightShardMergeError,
  type PreflightShardMergeInput,
  type PreflightShardMergeReceipt,
  type PreflightShardMergeReceiptShard,
  type PreflightShardMergeResult,
} from "./preflight-shard-merge-contract.ts";
import { collectShardEvidence } from "./preflight-shard-merge-evidence.ts";

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

const assertNominalSegmentsHaveNoSpecializedEntries = (
  segments: readonly MatrixPreflightSegment[],
): void => {
  const preexisting = segments
    .filter((segment) => (segment.specialized?.length ?? 0) > 0)
    .map(({ state }) => state.stateId);
  if (preexisting.length > 0)
    throw new PreflightShardMergeError(
      `Nominal shard segments must not contain preexisting specialized entries: ${preexisting.join(", ")}`,
    );
};

const parseMergeSource = (value: SourceArtifact): SourceArtifact => {
  try {
    return parseSourceArtifact(value);
  } catch (error: unknown) {
    throw new PreflightShardMergeError(
      `SOURCE.json is invalid for shard merge: ${errorMessage(error)}`,
    );
  }
};

const parseMergeAssignment = (
  value: PreflightShardMergeInput["assignment"],
) => {
  try {
    return parsePreflightShardAssignment(value);
  } catch (error: unknown) {
    throw new PreflightShardMergeError(
      `PREFLIGHT_SHARD_ASSIGNMENT is invalid for shard merge: ${errorMessage(error)}`,
    );
  }
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
  const source = parseMergeSource(input.source);
  const assignment = parseMergeAssignment(input.assignment);
  assertPreflightShardAssignmentMatchesSource(source, assignment);
  const evidence = await collectShardEvidence({
    source,
    assignment,
    donorRoots: input.donorRoots,
    requests: input.completionRequests,
  });
  const orderedSegments: readonly MatrixPreflightSegment[] =
    assertExactSourceStateUnion({
      source,
      segments: evidence.segments,
    });
  assertNominalSegmentsHaveNoSpecializedEntries(orderedSegments);
  const preflight: PreflightArtifact = createPreflightArtifact({
    source,
    segments: attachSpecializedDeclarations(source, orderedSegments),
  });
  const finalEvidence = await collectShardEvidence({
    source,
    assignment,
    donorRoots: input.donorRoots,
    requests: input.completionRequests,
  });
  if (
    stableSerialize(evidence.snapshots) !==
    stableSerialize(finalEvidence.snapshots)
  )
    throw new PreflightShardMergeError(
      "Durable shard evidence drifted between initial collection and final stable reread",
    );
  const finalOrderedSegments: readonly MatrixPreflightSegment[] =
    assertExactSourceStateUnion({
      source,
      segments: finalEvidence.segments,
    });
  assertNominalSegmentsHaveNoSpecializedEntries(finalOrderedSegments);
  const finalPreflight: PreflightArtifact = createPreflightArtifact({
    source,
    segments: attachSpecializedDeclarations(source, finalOrderedSegments),
  });
  if (finalPreflight.preflightDigest !== preflight.preflightDigest)
    throw new PreflightShardMergeError(
      "Generated PREFLIGHT digest drifted between initial and final shard evidence",
    );
  const receipt = createMergeReceipt({
    source,
    assignment,
    preflightDigest: finalPreflight.preflightDigest,
    shards: finalEvidence.receiptShards,
  });
  assertPreflightShardMergeReceiptMatchesSource({
    source,
    assignment,
    donorRoots: input.donorRoots,
    preflight: finalPreflight,
    receipt,
  });
  return freezeDeep({ preflight: finalPreflight, receipt });
};

export const mergePreflightShardCompletions = mergePreflightShards;

export type {
  PreflightShardCompletionReadRequest,
  PreflightShardMergeInput,
  PreflightShardMergeResult,
} from "./preflight-shard-merge-contract.ts";
