import { z } from "zod";

import {
  sha256DigestSchema,
  sourceShaSchema,
  sourceTreeSchema,
  stableIdentifierSchema,
} from "../../source/contracts.ts";
import { stableId } from "../../support/ids.ts";
import { journalStateIdentitySchema } from "../journal/preflight-journal-contract.ts";

export const PREFLIGHT_SHARD_ASSIGNMENT_ARTIFACT =
  "PREFLIGHT_SHARD_ASSIGNMENT" as const;
export const PREFLIGHT_SHARD_ASSIGNMENT_VERSION = 1 as const;
export const PREFLIGHT_SHARD_ASSIGNMENT_WEIGHTING = "state-count-v1" as const;

const nonnegativeIntegerSchema = z.number().int().nonnegative();
const positiveIntegerSchema = z.number().int().positive();

/**
 * One source-bound nominal state. The complete state payload is retained so
 * parsing can recompute its digest without consulting a mutable worktree.
 */
const preflightShardStateSchema = journalStateIdentitySchema
  .extend({
    planIndex: nonnegativeIntegerSchema,
    groupKey: z.string().min(1),
  })
  .strict();

const shardBodySchema = z
  .object({
    logicalShardId: stableIdentifierSchema,
    shardIndex: nonnegativeIntegerSchema,
    states: z.array(preflightShardStateSchema).readonly(),
    groupKeys: z.array(z.string().min(1)).readonly(),
    totalWeight: nonnegativeIntegerSchema,
  })
  .strict();

const preflightShardSchema = shardBodySchema
  .extend({ shardDigest: sha256DigestSchema })
  .strict();

const assignmentBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_SHARD_ASSIGNMENT_ARTIFACT),
    version: z.literal(PREFLIGHT_SHARD_ASSIGNMENT_VERSION),
    mode: z.literal("sharded"),
    weighting: z.literal(PREFLIGHT_SHARD_ASSIGNMENT_WEIGHTING),
    sourceSha: sourceShaSchema,
    sourceTree: sourceTreeSchema,
    treeDigest: sha256DigestSchema,
    sourceDigest: sha256DigestSchema,
    planDigest: sha256DigestSchema,
    states: z.array(preflightShardStateSchema).readonly(),
    specializedDeclarationIds: z.array(stableIdentifierSchema).readonly(),
    shardCount: positiveIntegerSchema,
    shards: z.array(preflightShardSchema).readonly(),
  })
  .strict();

export const preflightShardAssignmentSchema = assignmentBodySchema
  .extend({ assignmentDigest: sha256DigestSchema })
  .strict();

export type PreflightShardState = z.infer<typeof preflightShardStateSchema>;
export type PreflightShard = z.infer<typeof preflightShardSchema>;
export type PreflightShardAssignment = z.infer<
  typeof preflightShardAssignmentSchema
>;

export class PreflightShardAssignmentError extends Error {
  override readonly name = "PreflightShardAssignmentError";
}

export type AssignmentIdentity = Pick<
  PreflightShardAssignment,
  | "sourceSha"
  | "sourceTree"
  | "treeDigest"
  | "sourceDigest"
  | "planDigest"
  | "shardCount"
>;

const shardIdentityFor = (
  identity: AssignmentIdentity,
  shardIndex: number,
): Readonly<{
  readonly sourceSha: string;
  readonly sourceTree: string;
  readonly treeDigest: string;
  readonly sourceDigest: string;
  readonly planDigest: string;
  readonly shardCount: number;
  readonly shardIndex: number;
}> => ({
  sourceSha: identity.sourceSha,
  sourceTree: identity.sourceTree,
  treeDigest: identity.treeDigest,
  sourceDigest: identity.sourceDigest,
  planDigest: identity.planDigest,
  shardCount: identity.shardCount,
  shardIndex,
});

export const logicalShardIdFor = (
  identity: AssignmentIdentity,
  shardIndex: number,
): string =>
  stableId("preflight-shard", shardIdentityFor(identity, shardIndex));
