import { z } from "zod";

import {
  matrixAxesSchema,
  seedProfileSchema,
  sha256DigestSchema,
  sourceShaSchema,
  sourceTreeSchema,
  stableIdentifierSchema,
} from "../source/contracts.ts";
import { freezeDeep } from "../source/manifest-source.ts";
import type { SourceArtifact } from "../source/source-artifact.ts";
import { sha256Hex } from "../support/ids.ts";
import { routeForState } from "./playwright-preflight-support.ts";

export const PREFLIGHT_JOURNAL_ARTIFACT = "PREFLIGHT_JOURNAL" as const;
export const PREFLIGHT_JOURNAL_VERSION = 1 as const;

const JOURNAL_STATUSES = ["STARTED", "PASS", "FAIL", "AMBIGUOUS"] as const;
const journalStatusSchema = z.enum(JOURNAL_STATUSES);
const positiveIntegerSchema = z.number().int().positive();

export const journalStateSchema = z
  .object({
    stateId: stableIdentifierSchema,
    pairwiseDigest: sha256DigestSchema,
    profile: seedProfileSchema,
    axes: matrixAxesSchema,
  })
  .strict();

export const journalStateIdentitySchema = z
  .object({
    state: journalStateSchema,
    stateDigest: sha256DigestSchema,
    role: z.string().min(1),
    catalogRoute: z.string().min(1),
    resolvedRoute: z.string().min(1),
  })
  .strict();

export const journalIdentitySchema = z
  .object({
    sourceSha: sourceShaSchema,
    sourceTree: sourceTreeSchema,
    treeDigest: sha256DigestSchema,
    sourceDigest: sha256DigestSchema,
    planDigest: sha256DigestSchema,
    assignmentDigest: sha256DigestSchema,
  })
  .strict();

const journalRecordBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_JOURNAL_ARTIFACT),
    version: z.literal(PREFLIGHT_JOURNAL_VERSION),
    sequence: positiveIntegerSchema,
    attempt: positiveIntegerSchema,
    event: z.enum(["started", "terminal"]),
    status: journalStatusSchema,
    planIndex: z.number().int().nonnegative(),
    ...journalIdentitySchema.shape,
    ...journalStateIdentitySchema.shape,
    segmentDigest: sha256DigestSchema.nullable(),
    artifactPath: z.string().min(1).nullable(),
    artifactDigest: sha256DigestSchema.nullable(),
    previousRecordDigest: sha256DigestSchema.nullable(),
  })
  .strict();

type JournalRecordBody = z.infer<typeof journalRecordBodySchema>;
type JournalRecordIssue = Readonly<{
  readonly path: (string | number)[];
  readonly message: string;
}>;

const startedRecordIssuesFor = (
  record: JournalRecordBody,
): readonly JournalRecordIssue[] => [
  ...(record.status !== "STARTED"
    ? [
        {
          path: ["status"],
          message: "started journal records must have STARTED status",
        },
      ]
    : []),
  ...(record.segmentDigest !== null ||
  record.artifactPath !== null ||
  record.artifactDigest !== null
    ? [
        {
          path: ["segmentDigest"],
          message: "started journal records cannot carry terminal artifacts",
        },
      ]
    : []),
];

const terminalRecordIssuesFor = (
  record: JournalRecordBody,
): readonly JournalRecordIssue[] => {
  const hasArtifact =
    record.segmentDigest !== null ||
    record.artifactPath !== null ||
    record.artifactDigest !== null;
  const completeArtifact =
    record.segmentDigest !== null &&
    record.artifactPath !== null &&
    record.artifactDigest !== null;
  return [
    ...(record.status === "STARTED"
      ? [
          {
            path: ["status"],
            message: "terminal journal records must have a terminal status",
          },
        ]
      : []),
    ...(record.status === "PASS" && !completeArtifact
      ? [
          {
            path: ["artifactDigest"],
            message:
              "PASS journal records must carry segment and artifact digests",
          },
        ]
      : []),
    ...(record.status !== "PASS" && hasArtifact
      ? [
          {
            path: ["artifactDigest"],
            message:
              "failed or ambiguous journal records cannot carry PASS artifacts",
          },
        ]
      : []),
  ];
};

export const preflightJournalRecordSchema = journalRecordBodySchema
  .extend({ recordDigest: sha256DigestSchema })
  .strict()
  .superRefine((record, context) => {
    const issues =
      record.event === "started"
        ? startedRecordIssuesFor(record)
        : terminalRecordIssuesFor(record);
    issues.forEach((issue) => context.addIssue({ code: "custom", ...issue }));
  });

export type PreflightJournalRecord = z.infer<
  typeof preflightJournalRecordSchema
>;
export type PreflightJournalPassRecord = PreflightJournalRecord & {
  readonly event: "terminal";
  readonly status: "PASS";
  readonly segmentDigest: string;
  readonly artifactPath: string;
  readonly artifactDigest: string;
};
export type PreflightJournalState = z.infer<typeof journalStateSchema>;
export type PreflightJournalStateIdentity = z.infer<
  typeof journalStateIdentitySchema
>;
export type PreflightJournalStatus = (typeof JOURNAL_STATUSES)[number];

export class PreflightJournalError extends Error {
  override readonly name: string = "PreflightJournalError";
}

export class PreflightJournalValidationError extends PreflightJournalError {
  override readonly name = "PreflightJournalValidationError";

  constructor(readonly issues: readonly string[]) {
    super(`Preflight journal rejected: ${issues.join("; ")}`);
  }
}

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const preflightJournalRecordBody = (
  record: PreflightJournalRecord,
): Omit<PreflightJournalRecord, "recordDigest"> => {
  const { recordDigest: _recordDigest, ...body } = record;
  return body;
};

export const parsePreflightJournalRecord = (
  value: unknown,
): PreflightJournalRecord => {
  const record = preflightJournalRecordSchema.parse(value);
  if (sha256Hex(preflightJournalRecordBody(record)) !== record.recordDigest)
    throw new PreflightJournalError(
      `Journal record ${record.sequence} digest does not match contents`,
    );
  return freezeDeep(record);
};

const stateBodyFor = (input: {
  readonly state: PreflightJournalState;
  readonly role: string;
  readonly catalogRoute: string;
  readonly resolvedRoute: string;
}) => ({
  state: input.state,
  role: input.role,
  catalogRoute: input.catalogRoute,
  resolvedRoute: input.resolvedRoute,
});

export const preflightJournalStateDigest = (input: {
  readonly state: PreflightJournalState;
  readonly role: string;
  readonly catalogRoute: string;
  readonly resolvedRoute: string;
}): string => sha256Hex(stateBodyFor(input));

const journalStateFor = (
  state: SourceArtifact["plan"]["states"][number],
): PreflightJournalState =>
  journalStateSchema.parse({
    stateId: state.stateId,
    pairwiseDigest: state.pairwiseDigest,
    profile: state.profile,
    axes: state.axes,
  });

export const routeIdentityFor = (
  source: SourceArtifact,
  state: SourceArtifact["plan"]["states"][number],
): Readonly<{
  readonly role: string;
  readonly catalogRoute: string;
  readonly resolvedRoute: string;
}> => {
  const route = routeForState(source, state);
  return {
    role: route.role,
    catalogRoute: route.catalogRoute,
    resolvedRoute: route.resolvedRoute,
  };
};

export const preflightJournalIdentityFor = (
  source: SourceArtifact,
  assignmentDigest: string,
  state: SourceArtifact["plan"]["states"][number],
): PreflightJournalStateIdentity &
  Pick<
    PreflightJournalRecord,
    | "sourceSha"
    | "sourceTree"
    | "treeDigest"
    | "sourceDigest"
    | "planDigest"
    | "assignmentDigest"
  > => {
  const route = routeIdentityFor(source, state);
  const journalState = journalStateFor(state);
  return {
    sourceSha: source.sourceSha,
    sourceTree: source.sourceTree,
    treeDigest: source.treeDigest,
    sourceDigest: source.sourceDigest,
    planDigest: source.plan.digest,
    assignmentDigest,
    state: journalState,
    stateDigest: preflightJournalStateDigest({
      state: journalState,
      ...route,
    }),
    ...route,
  };
};

export const expectedJournalStateFor = (
  source: SourceArtifact,
): readonly {
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly route: ReturnType<typeof routeForState>;
  readonly index: number;
}[] =>
  source.plan.states.map((state, index) => ({
    state,
    route: routeForState(source, state),
    index,
  }));

export const stateIndexFor = (
  source: SourceArtifact,
  stateId: string,
): number => {
  const index = source.plan.states.findIndex(
    ({ stateId: candidate }) => candidate === stateId,
  );
  if (index === -1)
    throw new PreflightJournalError(`Unknown preflight state ${stateId}`);
  return index;
};
