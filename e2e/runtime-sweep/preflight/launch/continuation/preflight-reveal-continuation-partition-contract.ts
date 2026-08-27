import { z } from "zod";

import { sha256Hex } from "../../../support/ids.ts";
import { REVEAL_CONTINUATION_LIMITS } from "../../reveal/continuation/contracts/preflight-reveal-continuation-limits.ts";
import type { RevealExecutionGrant } from "../../reveal/continuation/contracts/preflight-reveal-continuation-schemas.ts";
import { chainHeadsSchema } from "../../reveal/continuation/contracts/preflight-reveal-continuation-schemas.ts";

/** A partition is an execution window, not an independent coverage claim. */
export const PREFLIGHT_REVEAL_AGGREGATE_PARTITION_PLAN =
  "PREFLIGHT_REVEAL_AGGREGATE_PARTITION_PLAN" as const;
export const PREFLIGHT_REVEAL_AGGREGATE_PARTITION_RECEIPT =
  "PREFLIGHT_REVEAL_AGGREGATE_PARTITION_RECEIPT" as const;
export const PREFLIGHT_REVEAL_AGGREGATE_PARTITION_COMPLETE =
  "PREFLIGHT_REVEAL_AGGREGATE_PARTITION_COMPLETE" as const;
export const PREFLIGHT_REVEAL_AGGREGATE_PARTITION_VERSION = 2 as const;
/** The plan seals the range rule; receipts seal the exact predecessor/end pair. */
export const PREFLIGHT_REVEAL_AGGREGATE_CANDIDATE_RANGE_POLICY =
  "predecessor-end-contiguous-with-single-terminal-overshoot" as const;
/** Functional time is per partition; only the final reserve is supervisor-wide. */
export const PREFLIGHT_REVEAL_AGGREGATE_DEADLINE_POLICY =
  "partition-functional-budget-plus-global-teardown-reserve" as const;
export const PREFLIGHT_REVEAL_AGGREGATE_PARTITION_CLEANUP_SCOPE =
  "CHILD_PROCESS_GROUPS" as const;
export const PREFLIGHT_REVEAL_AGGREGATE_COMPLETION_SCOPE =
  "COVERAGE_ONLY" as const;
/** A final child can add at most the source-bound cooperative candidate limit. */
export const REVEAL_PARTITION_MAX_TERMINAL_OVERSHOOT =
  REVEAL_CONTINUATION_LIMITS.maxTerminalCandidates - 1;

const PARTITION_ID_WIDTH = 4;
const MAX_PARTITION_COUNT = 9999;

const digestSchema = z.string().regex(/^[0-9a-f]{64}$/u);
const sourceShaSchema = z.string().regex(/^[0-9a-f]{40}$/u);
const positiveIntegerSchema = z.number().int().positive();
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const partitionIdSchema = z.string().regex(/^partition-\d{4}$/u);

const partitionEntrySchema = z
  .object({
    partitionId: partitionIdSchema,
    partitionIndex: nonNegativeIntegerSchema,
    maxEndCandidateCountExclusive: positiveIntegerSchema,
  })
  .strict();

const planBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_REVEAL_AGGREGATE_PARTITION_PLAN),
    version: z.literal(PREFLIGHT_REVEAL_AGGREGATE_PARTITION_VERSION),
    campaignId: z.string().min(1),
    sourceSha: sourceShaSchema,
    sourceTree: sourceShaSchema,
    sourceDigest: digestSchema,
    planDigest: digestSchema,
    stateId: z.string().min(1),
    stateDigest: digestSchema,
    profile: z.string().min(1),
    role: z.string().min(1),
    route: z.string().min(1),
    routeDigest: digestSchema,
    candidateRangePolicy: z.literal(
      PREFLIGHT_REVEAL_AGGREGATE_CANDIDATE_RANGE_POLICY,
    ),
    deadlinePolicy: z.literal(PREFLIGHT_REVEAL_AGGREGATE_DEADLINE_POLICY),
    partitionCandidateLimit: positiveIntegerSchema,
    partitionMaxMs: positiveIntegerSchema,
    teardownReserveMs: positiveIntegerSchema,
    maxPartitions: positiveIntegerSchema,
    supervisorMaxMs: positiveIntegerSchema,
    partitions: z.array(partitionEntrySchema).readonly(),
  })
  .strict();

export const revealPartitionPlanSchema = planBodySchema
  .extend({ partitionPlanDigest: digestSchema })
  .strict();

const partitionReceiptBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_REVEAL_AGGREGATE_PARTITION_RECEIPT),
    version: z.literal(PREFLIGHT_REVEAL_AGGREGATE_PARTITION_VERSION),
    partitionPlanDigest: digestSchema,
    partitionId: partitionIdSchema,
    partitionIndex: nonNegativeIntegerSchema,
    predecessorPartitionDigest: digestSchema.nullable(),
    attemptId: z.string().min(1),
    startChildOrdinal: nonNegativeIntegerSchema,
    endChildOrdinal: nonNegativeIntegerSchema,
    startCandidateCount: nonNegativeIntegerSchema,
    endCandidateCount: nonNegativeIntegerSchema,
    startCheckpointDigest: digestSchema.nullable(),
    endCheckpointDigest: digestSchema,
    startSampleSequence: nonNegativeIntegerSchema.nullable(),
    endSampleSequence: nonNegativeIntegerSchema,
    startGrantDigest: digestSchema.nullable(),
    endGrantDigest: digestSchema.nullable(),
    frontier: z.enum(["non-empty", "empty"]),
    boundaryAuthorityTag: digestSchema,
    cleanup: z.literal("PASS"),
    cleanupScope: z.literal(PREFLIGHT_REVEAL_AGGREGATE_PARTITION_CLEANUP_SCOPE),
    cleanupEvidence: z
      .array(
        z
          .object({
            status: z.literal("PASS"),
            ownership: z.literal("OWNED"),
            processGroup: z.literal("GONE"),
            pid: positiveIntegerSchema,
            pgid: positiveIntegerSchema,
            childOrdinal: nonNegativeIntegerSchema,
          })
          .strict(),
      )
      .min(1)
      .readonly(),
    startChain: chainHeadsSchema,
    endChain: chainHeadsSchema,
  })
  .strict();

export const revealPartitionReceiptSchema = partitionReceiptBodySchema
  .extend({ partitionReceiptDigest: digestSchema })
  .strict();

const aggregateCompletionBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_REVEAL_AGGREGATE_PARTITION_COMPLETE),
    version: z.literal(PREFLIGHT_REVEAL_AGGREGATE_PARTITION_VERSION),
    partitionPlanDigest: digestSchema,
    status: z.literal("COMPLETE"),
    finalPartitionIndex: nonNegativeIntegerSchema,
    completedCandidateCount: nonNegativeIntegerSchema,
    finalChain: chainHeadsSchema,
    partitionReceiptDigests: z.array(digestSchema).min(1).readonly(),
    cleanupEvidenceCount: positiveIntegerSchema,
    cleanup: z.literal("PASS"),
    cleanupScope: z.literal(PREFLIGHT_REVEAL_AGGREGATE_PARTITION_CLEANUP_SCOPE),
    completionScope: z.literal(PREFLIGHT_REVEAL_AGGREGATE_COMPLETION_SCOPE),
  })
  .strict();

export const revealAggregateCompletionSchema = aggregateCompletionBodySchema
  .extend({ aggregateCompletionDigest: digestSchema })
  .strict();

export type RevealPartitionPlan = z.infer<typeof revealPartitionPlanSchema>;
export type RevealPartitionReceipt = z.infer<
  typeof revealPartitionReceiptSchema
>;
export type RevealPartitionBoundaryBody = Omit<
  RevealPartitionReceipt,
  "boundaryAuthorityTag" | "partitionReceiptDigest"
>;
export type RevealAggregateCompletion = z.infer<
  typeof revealAggregateCompletionSchema
>;
export type RevealPartitionChain = RevealExecutionGrant["chain"];
export type RevealPartitionCleanupEvidence = z.infer<
  typeof partitionReceiptBodySchema
>["cleanupEvidence"][number];

export type RevealPartitionPlanInput = Readonly<{
  readonly campaignId: string;
  readonly sourceSha: string;
  readonly sourceTree: string;
  readonly sourceDigest: string;
  readonly planDigest: string;
  readonly stateId: string;
  readonly stateDigest: string;
  readonly profile: string;
  readonly role: string;
  readonly route: string;
  readonly routeDigest: string;
  readonly maxRevealActions: number;
  readonly partitionCandidateLimit: number;
  readonly partitionMaxMs: number;
  readonly teardownReserveMs: number;
}>;

const assertPlanShape = (
  plan: Omit<RevealPartitionPlan, "partitionPlanDigest">,
): void => {
  if (plan.partitions.length !== plan.maxPartitions)
    throw new Error(
      "Aggregate partition plan must contain every planned partition",
    );
  if (plan.maxPartitions < 1 || plan.partitionCandidateLimit < 1)
    throw new Error("Aggregate partition plan limits must be positive");
  if (
    plan.supervisorMaxMs !==
    plan.maxPartitions * plan.partitionMaxMs + plan.teardownReserveMs
  )
    throw new Error(
      "Aggregate partition supervisor budget is not derived from the plan",
    );
  for (const [index, entry] of plan.partitions.entries()) {
    if (
      entry.partitionIndex !== index ||
      entry.partitionId !==
        `partition-${String(index + 1).padStart(PARTITION_ID_WIDTH, "0")}` ||
      entry.maxEndCandidateCountExclusive !==
        (index + 1) * plan.partitionCandidateLimit +
          REVEAL_PARTITION_MAX_TERMINAL_OVERSHOOT
    )
      throw new Error(
        "Aggregate partition plan is not contiguous or canonical",
      );
  }
};

export const createRevealPartitionPlan = (
  input: RevealPartitionPlanInput,
): RevealPartitionPlan => {
  const maxPartitions = Math.ceil(
    input.maxRevealActions / input.partitionCandidateLimit,
  );
  if (
    !Number.isSafeInteger(input.maxRevealActions) ||
    input.maxRevealActions < 1 ||
    !Number.isSafeInteger(input.partitionCandidateLimit) ||
    input.partitionCandidateLimit < 1 ||
    !Number.isSafeInteger(input.partitionMaxMs) ||
    input.partitionMaxMs < 1 ||
    !Number.isSafeInteger(input.teardownReserveMs) ||
    input.teardownReserveMs < 1 ||
    !Number.isSafeInteger(maxPartitions) ||
    maxPartitions < 1 ||
    maxPartitions > MAX_PARTITION_COUNT
  )
    throw new Error(
      "Aggregate partition limits must be safe positive integers",
    );
  const partitions = Array.from({ length: maxPartitions }, (_, index) => ({
    partitionId: `partition-${String(index + 1).padStart(PARTITION_ID_WIDTH, "0")}`,
    partitionIndex: index,
    maxEndCandidateCountExclusive:
      (index + 1) * input.partitionCandidateLimit +
      REVEAL_PARTITION_MAX_TERMINAL_OVERSHOOT,
  }));
  const body = planBodySchema.parse({
    artifact: PREFLIGHT_REVEAL_AGGREGATE_PARTITION_PLAN,
    version: PREFLIGHT_REVEAL_AGGREGATE_PARTITION_VERSION,
    campaignId: input.campaignId,
    sourceSha: input.sourceSha,
    sourceTree: input.sourceTree,
    sourceDigest: input.sourceDigest,
    planDigest: input.planDigest,
    stateId: input.stateId,
    stateDigest: input.stateDigest,
    profile: input.profile,
    role: input.role,
    route: input.route,
    routeDigest: input.routeDigest,
    candidateRangePolicy: PREFLIGHT_REVEAL_AGGREGATE_CANDIDATE_RANGE_POLICY,
    deadlinePolicy: PREFLIGHT_REVEAL_AGGREGATE_DEADLINE_POLICY,
    partitionCandidateLimit: input.partitionCandidateLimit,
    partitionMaxMs: input.partitionMaxMs,
    teardownReserveMs: input.teardownReserveMs,
    maxPartitions,
    supervisorMaxMs:
      maxPartitions * input.partitionMaxMs + input.teardownReserveMs,
    partitions,
  });
  assertPlanShape(body);
  return revealPartitionPlanSchema.parse({
    ...body,
    partitionPlanDigest: sha256Hex(body),
  });
};

export const parseRevealPartitionPlan = (
  value: unknown,
): RevealPartitionPlan => {
  const parsed = revealPartitionPlanSchema.parse(value);
  const { partitionPlanDigest: _digest, ...body } = parsed;
  assertPlanShape(body);
  if (sha256Hex(body) !== parsed.partitionPlanDigest)
    throw new Error("Aggregate partition plan digest drifted");
  return parsed;
};

export { aggregateCompletionBodySchema };
