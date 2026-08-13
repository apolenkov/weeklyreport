import { z } from "zod";

import {
  sha256DigestSchema,
  sourceShaSchema,
  sourceTreeSchema,
  stableIdentifierSchema,
} from "../../../source/contracts.ts";
import { freezeDeep } from "../../../source/manifest-source.ts";
import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { sha256Hex } from "../../../support/ids.ts";
import type { PreflightArtifact } from "../../artifacts/preflight-artifact.ts";
import type { PreflightShardJournalContext } from "../journal/preflight-shard-journal-context.ts";
import type { PreflightShardAssignment } from "../preflight-shard-assignment.ts";
import {
  resourceProofDonorIdSchema,
  resourceProofPathSchema,
} from "../resources/preflight-shard-resource-proof-contract.ts";
import type { PreflightShardResourceProofDonorRoot } from "../resources/preflight-shard-resource-proof-set-validation.ts";

export const PREFLIGHT_SHARD_MERGE_RECEIPT =
  "PREFLIGHT_SHARD_MERGE_RECEIPT" as const;
export const PREFLIGHT_SHARD_MERGE_RECEIPT_VERSION = 1 as const;

const positiveIntegerSchema = z.number().int().positive();
const nonnegativeIntegerSchema = z.number().int().nonnegative();

/** Durable identities consumed by one canonical shard merge. */
export const preflightShardMergeReceiptShardSchema = z
  .object({
    logicalShardId: stableIdentifierSchema,
    shardIndex: nonnegativeIntegerSchema,
    shardDigest: sha256DigestSchema,
    donorId: resourceProofDonorIdSchema,
    donorRoot: resourceProofPathSchema,
    shardAttemptId: stableIdentifierSchema,
    resourceProofPath: resourceProofPathSchema,
    resourceProofDigest: sha256DigestSchema,
    completionPath: resourceProofPathSchema,
    completionDigest: sha256DigestSchema,
    journalPath: resourceProofPathSchema,
    journalRecordCount: positiveIntegerSchema,
    journalTailDigest: sha256DigestSchema,
    assignedStateIds: z.array(stableIdentifierSchema).min(1).readonly(),
    assignedStateDigests: z.array(sha256DigestSchema).min(1).readonly(),
  })
  .strict()
  .superRefine((shard, context) => {
    if (shard.assignedStateIds.length !== shard.assignedStateDigests.length)
      context.addIssue({
        code: "custom",
        path: ["assignedStateDigests"],
        message: "assigned state ids and digests must have equal length",
      });
  });

const receiptBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_SHARD_MERGE_RECEIPT),
    version: z.literal(PREFLIGHT_SHARD_MERGE_RECEIPT_VERSION),
    sourceSha: sourceShaSchema,
    sourceTree: sourceTreeSchema,
    treeDigest: sha256DigestSchema,
    sourceDigest: sha256DigestSchema,
    planDigest: sha256DigestSchema,
    assignmentDigest: sha256DigestSchema,
    shardCount: positiveIntegerSchema,
    shards: z.array(preflightShardMergeReceiptShardSchema).readonly(),
    preflightDigest: sha256DigestSchema,
  })
  .strict()
  .superRefine((receipt, context) => {
    if (receipt.shards.length !== receipt.shardCount)
      context.addIssue({
        code: "custom",
        path: ["shards"],
        message: "merge receipt shard count does not match shard records",
      });
    receipt.shards.forEach((shard, expectedIndex) => {
      if (shard.shardIndex !== expectedIndex)
        context.addIssue({
          code: "custom",
          path: ["shards", expectedIndex, "shardIndex"],
          message: "merge receipt shards must remain in assignment order",
        });
    });
  });

export const preflightShardMergeReceiptSchema = receiptBodySchema
  .extend({ receiptDigest: sha256DigestSchema })
  .strict();

export type PreflightShardMergeReceiptShard = z.infer<
  typeof preflightShardMergeReceiptShardSchema
>;
export type PreflightShardMergeReceipt = z.infer<
  typeof preflightShardMergeReceiptSchema
>;

export class PreflightShardMergeError extends Error {
  override readonly name = "PreflightShardMergeError";
}

export type PreflightShardCompletionReadRequest = Readonly<{
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly journalPath: string;
  readonly resourceProofPath: string;
}>;

export type PreflightShardMergeInput = Readonly<{
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
  readonly donorRoots: readonly PreflightShardResourceProofDonorRoot[];
  readonly completionRequests: readonly PreflightShardCompletionReadRequest[];
}>;

export type PreflightShardMergeResult = Readonly<{
  readonly preflight: PreflightArtifact;
  readonly receipt: PreflightShardMergeReceipt;
}>;

export const preflightShardMergeReceiptBody = (
  receipt: PreflightShardMergeReceipt,
): Omit<PreflightShardMergeReceipt, "receiptDigest"> => {
  const { receiptDigest: _receiptDigest, ...body } = receipt;
  return body;
};

export const parsePreflightShardMergeReceipt = (
  value: unknown,
): PreflightShardMergeReceipt => {
  try {
    const receipt = preflightShardMergeReceiptSchema.parse(value);
    if (
      sha256Hex(preflightShardMergeReceiptBody(receipt)) !==
      receipt.receiptDigest
    )
      throw new PreflightShardMergeError(
        "PREFLIGHT_SHARD_MERGE_RECEIPT digest does not match contents",
      );
    return freezeDeep(receipt);
  } catch (error: unknown) {
    if (error instanceof PreflightShardMergeError) throw error;
    throw new PreflightShardMergeError(
      `Invalid PREFLIGHT_SHARD_MERGE_RECEIPT: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

export {
  assertPreflightShardMergeReceiptMatches,
  assertPreflightShardMergeReceiptMatchesSource,
} from "./preflight-shard-merge-receipt-validation.ts";
