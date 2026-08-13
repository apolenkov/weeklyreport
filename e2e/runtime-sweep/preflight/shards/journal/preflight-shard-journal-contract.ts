import { z } from "zod";

import {
  sha256DigestSchema,
  sourceShaSchema,
  sourceTreeSchema,
  stableIdentifierSchema,
} from "../../../source/contracts.ts";
import { freezeDeep } from "../../../source/manifest-source.ts";
import { sha256Hex } from "../../../support/ids.ts";
import { journalStateSchema } from "../../journal/preflight-journal-contract.ts";
import { redact } from "../../observability/environment-observer-events.ts";
import { resourceProofDonorIdSchema } from "../resources/preflight-shard-resource-proof-contract.ts";

export const PREFLIGHT_SHARD_JOURNAL = "PREFLIGHT_SHARD_JOURNAL" as const;
export const PREFLIGHT_SHARD_JOURNAL_VERSION = 1 as const;
export const PREFLIGHT_SHARD_JOURNAL_STATUSES = [
  "STARTED",
  "PASS",
  "FAIL",
  "AMBIGUOUS",
] as const;

const statusSchema = z.enum(PREFLIGHT_SHARD_JOURNAL_STATUSES);
const positiveIntegerSchema = z.number().int().positive();
const nonnegativeIntegerSchema = z.number().int().nonnegative();
const MAX_FAILURE_SUMMARY_LENGTH = 500;
const COMPLETE_RECEIPT_FIELD_COUNT = 3;
const failureSummarySchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_FAILURE_SUMMARY_LENGTH)
  .regex(/^[^\u0000-\u001F\u007F]+$/u, "must not contain control characters")
  .refine((value) => redact(value) === value, "must already be redacted");

export const preflightShardJournalIdentitySchema = z
  .object({
    sourceSha: sourceShaSchema,
    sourceTree: sourceTreeSchema,
    treeDigest: sha256DigestSchema,
    sourceDigest: sha256DigestSchema,
    planDigest: sha256DigestSchema,
    assignmentDigest: sha256DigestSchema,
    logicalShardId: stableIdentifierSchema,
    shardIndex: nonnegativeIntegerSchema,
    shardCount: positiveIntegerSchema,
    shardDigest: sha256DigestSchema,
    donorId: resourceProofDonorIdSchema,
    shardAttemptId: stableIdentifierSchema,
    resourceProofDigest: sha256DigestSchema,
  })
  .strict();

export const preflightShardJournalStateSchema = z
  .object({
    planIndex: nonnegativeIntegerSchema,
    state: journalStateSchema,
    stateDigest: sha256DigestSchema,
    role: z.string().min(1),
    catalogRoute: z.string().min(1),
    resolvedRoute: z.string().min(1),
    groupKey: z.string().min(1),
  })
  .strict();

const recordBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_SHARD_JOURNAL),
    version: z.literal(PREFLIGHT_SHARD_JOURNAL_VERSION),
    sequence: positiveIntegerSchema,
    attempt: positiveIntegerSchema,
    event: z.enum(["started", "terminal"]),
    status: statusSchema,
    ...preflightShardJournalIdentitySchema.shape,
    ...preflightShardJournalStateSchema.shape,
    receiptPath: z.string().min(1).nullable(),
    receiptDigest: sha256DigestSchema.nullable(),
    segmentDigest: sha256DigestSchema.nullable(),
    failureSummary: failureSummarySchema.nullable(),
    previousRecordDigest: sha256DigestSchema.nullable(),
  })
  .strict();

type RecordBody = z.infer<typeof recordBodySchema>;
type ShapeIssue = Readonly<{
  readonly path: (string | number)[];
  readonly message: string;
}>;

const startedIssues = (record: RecordBody): readonly ShapeIssue[] => {
  const hasOutcome =
    record.receiptPath !== null ||
    record.receiptDigest !== null ||
    record.segmentDigest !== null ||
    record.failureSummary !== null;
  return [
    ...(record.status === "STARTED"
      ? []
      : [
          {
            path: ["status"],
            message: "started event requires STARTED status",
          },
        ]),
    ...(hasOutcome
      ? [
          {
            path: ["receiptPath"],
            message: "started event cannot carry an outcome",
          },
        ]
      : []),
  ];
};

const terminalIssues = (record: RecordBody): readonly ShapeIssue[] => {
  const receiptCount = [
    record.receiptPath,
    record.receiptDigest,
    record.segmentDigest,
  ].filter((value) => value !== null).length;
  const isPass = record.status === "PASS";
  const isFailure = record.status === "FAIL" || record.status === "AMBIGUOUS";
  return [
    ...(record.status === "STARTED"
      ? [
          {
            path: ["status"],
            message: "terminal event requires a terminal status",
          },
        ]
      : []),
    ...(isPass && receiptCount !== COMPLETE_RECEIPT_FIELD_COUNT
      ? [
          {
            path: ["receiptDigest"],
            message: "PASS requires complete receipt references",
          },
        ]
      : []),
    ...(isPass && record.failureSummary !== null
      ? [
          {
            path: ["failureSummary"],
            message: "PASS cannot carry a failure summary",
          },
        ]
      : []),
    ...(isFailure && (receiptCount !== 0 || record.failureSummary === null)
      ? [
          {
            path: ["failureSummary"],
            message: "FAIL and AMBIGUOUS require only a failure summary",
          },
        ]
      : []),
  ];
};

export const preflightShardJournalRecordSchema = recordBodySchema
  .extend({ recordDigest: sha256DigestSchema })
  .strict()
  .superRefine((record, context) => {
    const issues =
      record.event === "started"
        ? startedIssues(record)
        : terminalIssues(record);
    issues.forEach((issue) => context.addIssue({ code: "custom", ...issue }));
  });

export type PreflightShardJournalIdentity = z.infer<
  typeof preflightShardJournalIdentitySchema
>;
export type PreflightShardJournalState = z.infer<
  typeof preflightShardJournalStateSchema
>;
export type PreflightShardJournalRecord = z.infer<
  typeof preflightShardJournalRecordSchema
>;
export type PreflightShardJournalPassRecord = PreflightShardJournalRecord & {
  readonly event: "terminal";
  readonly status: "PASS";
  readonly receiptPath: string;
  readonly receiptDigest: string;
  readonly segmentDigest: string;
  readonly failureSummary: null;
};
export type PreflightShardJournalStatus =
  (typeof PREFLIGHT_SHARD_JOURNAL_STATUSES)[number];

export class PreflightShardJournalError extends Error {
  override readonly name: string = "PreflightShardJournalError";
}

export class PreflightShardJournalValidationError extends PreflightShardJournalError {
  override readonly name = "PreflightShardJournalValidationError";

  constructor(readonly issues: readonly string[]) {
    super(`Preflight shard journal rejected: ${issues.join("; ")}`);
  }
}

export const preflightShardJournalRecordBody = (
  record: PreflightShardJournalRecord,
): Omit<PreflightShardJournalRecord, "recordDigest"> => {
  const { recordDigest: _recordDigest, ...body } = record;
  return body;
};

export const parsePreflightShardJournalRecord = (
  value: unknown,
): PreflightShardJournalRecord => {
  const parsed = preflightShardJournalRecordSchema.safeParse(value);
  if (!parsed.success)
    throw new PreflightShardJournalError(
      `Invalid shard journal record: ${parsed.error.message}`,
    );
  const record = parsed.data;
  if (
    sha256Hex(preflightShardJournalRecordBody(record)) !== record.recordDigest
  )
    throw new PreflightShardJournalError(
      `Shard journal record ${record.sequence} digest does not match contents`,
    );
  return freezeDeep(record);
};
