import { z } from "zod";

import {
  sha256DigestSchema,
  stableIdentifierSchema,
} from "../../../source/contracts.ts";
import { freezeDeep } from "../../../source/manifest-source.ts";
import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import {
  PreflightShardJournalError,
  preflightShardJournalIdentitySchema,
} from "../journal/preflight-shard-journal-contract.ts";
import { resourceProofPathSchema } from "../resources/preflight-shard-resource-proof-contract.ts";

export const PREFLIGHT_SHARD_COMPLETE_ARTIFACT = "SHARD_COMPLETE" as const;
export const PREFLIGHT_SHARD_COMPLETE_VERSION = 1 as const;

const positiveIntegerSchema = z.number().int().positive();
const nonnegativeIntegerSchema = z.number().int().nonnegative();

/** The per-state evidence carried by an immutable shard completion. */
const preflightShardCompletionStateEvidenceSchema = z
  .object({
    stateId: stableIdentifierSchema,
    planIndex: nonnegativeIntegerSchema,
    stateDigest: sha256DigestSchema,
    groupKey: z.string().min(1),
    logicalShardId: stableIdentifierSchema,
    shardAttemptId: stableIdentifierSchema,
    resourceProofDigest: sha256DigestSchema,
    receiptPath: resourceProofPathSchema,
    receiptDigest: sha256DigestSchema,
    startedRecordDigest: sha256DigestSchema,
    segmentArtifactPath: resourceProofPathSchema,
    segmentArtifactDigest: sha256DigestSchema,
    segmentDigest: sha256DigestSchema,
    stateAttempt: positiveIntegerSchema,
    terminalPassRecordDigest: sha256DigestSchema,
  })
  .strict();

const completionBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_SHARD_COMPLETE_ARTIFACT),
    version: z.literal(PREFLIGHT_SHARD_COMPLETE_VERSION),
    ...preflightShardJournalIdentitySchema.shape,
    assignedStateIds: z.array(stableIdentifierSchema).min(1).readonly(),
    assignedStateDigests: z.array(sha256DigestSchema).min(1).readonly(),
    archiveRoot: resourceProofPathSchema,
    journalPath: resourceProofPathSchema,
    journalRecordCount: positiveIntegerSchema,
    journalTailDigest: sha256DigestSchema,
    stateEvidence: z
      .array(preflightShardCompletionStateEvidenceSchema)
      .min(1)
      .readonly(),
  })
  .strict()
  .superRefine((completion, context) => {
    if (
      completion.assignedStateIds.length !==
      completion.assignedStateDigests.length
    )
      context.addIssue({
        code: "custom",
        path: ["assignedStateDigests"],
        message: "assigned state ids and digests must have equal length",
      });
    if (completion.stateEvidence.length !== completion.assignedStateIds.length)
      context.addIssue({
        code: "custom",
        path: ["stateEvidence"],
        message: "state evidence must cover every assigned state",
      });
    completion.stateEvidence.forEach((evidence, index) => {
      if (
        evidence.stateId !== completion.assignedStateIds[index] ||
        evidence.stateDigest !== completion.assignedStateDigests[index]
      )
        context.addIssue({
          code: "custom",
          path: ["stateEvidence", index],
          message: "state evidence must match the assigned state identity",
        });
      if (
        evidence.logicalShardId !== completion.logicalShardId ||
        evidence.shardAttemptId !== completion.shardAttemptId ||
        evidence.resourceProofDigest !== completion.resourceProofDigest
      )
        context.addIssue({
          code: "custom",
          path: ["stateEvidence", index],
          message: "state evidence must match the shard attempt identity",
        });
    });
    const stateIds = completion.stateEvidence.map(({ stateId }) => stateId);
    const duplicate = stateIds.find(
      (stateId, index) => stateIds.indexOf(stateId) !== index,
    );
    if (duplicate !== undefined)
      context.addIssue({
        code: "custom",
        path: ["stateEvidence"],
        message: `state evidence contains duplicate state ${duplicate}`,
      });
    const outOfOrder = completion.stateEvidence.some(
      (evidence, index, all) =>
        index > 0 && evidence.planIndex <= (all[index - 1]?.planIndex ?? -1),
    );
    if (outOfOrder)
      context.addIssue({
        code: "custom",
        path: ["stateEvidence"],
        message: "state evidence must be ordered by increasing plan index",
      });
  });

const preflightShardCompletionSchema = completionBodySchema
  .extend({ completionDigest: sha256DigestSchema })
  .strict();

export type PreflightShardCompletion = z.infer<
  typeof preflightShardCompletionSchema
>;

export class PreflightShardCompletionError extends PreflightShardJournalError {
  override readonly name = "PreflightShardCompletionError";
}

export const preflightShardCompletionBody = (
  completion: PreflightShardCompletion,
): Omit<PreflightShardCompletion, "completionDigest"> => {
  const { completionDigest: _completionDigest, ...body } = completion;
  return body;
};

export const parsePreflightShardCompletion = (
  value: unknown,
): PreflightShardCompletion => {
  try {
    const completion = preflightShardCompletionSchema.parse(value);
    if (
      sha256Hex(preflightShardCompletionBody(completion)) !==
      completion.completionDigest
    )
      throw new PreflightShardCompletionError(
        "SHARD_COMPLETE digest does not match contents",
      );
    return freezeDeep(completion);
  } catch (error: unknown) {
    if (error instanceof PreflightShardCompletionError) throw error;
    throw new PreflightShardCompletionError(
      `Invalid SHARD_COMPLETE: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

export const assertPreflightShardCompletionEqual = (input: {
  readonly actual: PreflightShardCompletion;
  readonly expected: PreflightShardCompletion;
}): void => {
  if (stableSerialize(input.actual) !== stableSerialize(input.expected))
    throw new PreflightShardCompletionError(
      "SHARD_COMPLETE evidence is stale or does not match revalidated artifacts",
    );
};
