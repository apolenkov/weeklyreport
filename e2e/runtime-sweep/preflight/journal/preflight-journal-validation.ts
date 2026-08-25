import { sha256DigestSchema } from "../../source/contracts.ts";
import { freezeDeep } from "../../source/manifest-source.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import { stableSerialize } from "../../support/ids.ts";
import {
  errorMessage,
  expectedJournalStateFor,
  parsePreflightJournalRecord,
  preflightJournalIdentityFor,
  type PreflightJournalPassRecord,
  type PreflightJournalRecord,
  PreflightJournalValidationError,
} from "./preflight-journal-contract.ts";

type AttemptStatus = "STARTED" | "PASS" | "FAIL" | "AMBIGUOUS";
type AttemptState = Readonly<{
  readonly attempt: number;
  readonly status: AttemptStatus;
  readonly record: PreflightJournalRecord;
}>;

export type PreflightJournalValidation = Readonly<{
  readonly records: readonly PreflightJournalRecord[];
  readonly latestByState: ReadonlyMap<string, PreflightJournalRecord>;
  readonly passRecords: ReadonlyMap<string, PreflightJournalPassRecord>;
  readonly stateAttempts: ReadonlyMap<string, AttemptState>;
}>;

const identityIssuesFor = (input: {
  readonly record: PreflightJournalRecord;
  readonly source: SourceArtifact;
  readonly assignmentDigest: string;
  readonly expected: ReturnType<typeof expectedJournalStateFor>[number];
}): readonly string[] => {
  const identity = preflightJournalIdentityFor(
    input.source,
    input.assignmentDigest,
    input.expected.state,
  );
  const checks: readonly (readonly [string, boolean])[] = [
    ["source SHA", input.record.sourceSha === identity.sourceSha],
    ["source tree", input.record.sourceTree === identity.sourceTree],
    ["tree digest", input.record.treeDigest === identity.treeDigest],
    ["source digest", input.record.sourceDigest === identity.sourceDigest],
    ["plan digest", input.record.planDigest === identity.planDigest],
    [
      "assignment digest",
      input.record.assignmentDigest === identity.assignmentDigest,
    ],
    ["state id", input.record.state.stateId === identity.state.stateId],
    ["state digest", input.record.stateDigest === identity.stateDigest],
    [
      "state body",
      stableSerialize(input.record.state) === stableSerialize(identity.state),
    ],
    ["role", input.record.role === identity.role],
    ["catalog route", input.record.catalogRoute === identity.catalogRoute],
    ["resolved route", input.record.resolvedRoute === identity.resolvedRoute],
    ["plan index", input.record.planIndex === input.expected.index],
  ];
  return checks
    .filter(([, matches]) => !matches)
    .map(([field]) => `${input.record.state.stateId} has mismatched ${field}`);
};

interface ValidationContext {
  readonly issues: string[];
  readonly attempts: Map<string, AttemptState>;
  readonly latestByState: Map<string, PreflightJournalRecord>;
  readonly passRecords: Map<string, PreflightJournalPassRecord>;
  previousDigest: string | null;
  previousSequence: number;
  previousPlanIndex: number;
  openStateId: string | undefined;
}

const structuralIssuesFor = (input: {
  readonly record: PreflightJournalRecord;
  readonly source: SourceArtifact;
  readonly assignmentDigest: string;
  readonly expectedById: ReadonlyMap<
    string,
    ReturnType<typeof expectedJournalStateFor>[number]
  >;
  readonly context: ValidationContext;
}): boolean => {
  const { record, context } = input;
  const expected = input.expectedById.get(record.state.stateId);
  if (expected === undefined) {
    context.issues.push(`record ${record.sequence} references a foreign state`);
    return false;
  }
  context.issues.push(
    ...identityIssuesFor({
      record,
      source: input.source,
      assignmentDigest: input.assignmentDigest,
      expected,
    }),
  );
  if (record.sequence !== context.previousSequence + 1)
    context.issues.push(`record sequence ${record.sequence} is not contiguous`);
  if (record.previousRecordDigest !== context.previousDigest)
    context.issues.push(`record ${record.sequence} has a broken hash chain`);
  context.previousSequence = record.sequence;
  context.previousDigest = record.recordDigest;
  if (record.planIndex < context.previousPlanIndex)
    context.issues.push(
      `record ${record.sequence} is reordered against the source plan`,
    );
  if (record.planIndex > context.previousPlanIndex) {
    if (context.openStateId !== undefined)
      context.issues.push(
        `started-only state ${context.openStateId} is followed by another state`,
      );
    context.previousPlanIndex = record.planIndex;
  }
  return true;
};

const applyStartedAttempt = (
  context: ValidationContext,
  record: PreflightJournalRecord,
): void => {
  const prior = context.attempts.get(record.state.stateId);
  const validRetry =
    prior !== undefined &&
    prior.status !== "PASS" &&
    record.attempt === prior.attempt + 1;
  if (prior === undefined && record.attempt !== 1)
    context.issues.push(
      `state ${record.state.stateId} does not start at attempt 1`,
    );
  if (prior !== undefined && !validRetry)
    context.issues.push(
      `duplicate or invalid started record for ${record.state.stateId}`,
    );
  context.attempts.set(record.state.stateId, {
    attempt: record.attempt,
    status: "STARTED",
    record,
  });
  context.latestByState.set(record.state.stateId, record);
  context.openStateId = record.state.stateId;
};

const applyTerminalAttempt = (
  context: ValidationContext,
  record: PreflightJournalRecord,
): void => {
  const prior = context.attempts.get(record.state.stateId);
  if (prior?.status !== "STARTED")
    context.issues.push(
      `terminal record ${record.sequence} has no matching started record`,
    );
  else if (prior.attempt !== record.attempt)
    context.issues.push(
      `terminal record ${record.sequence} has a mismatched attempt`,
    );
  if (prior?.status === "STARTED") {
    context.attempts.set(record.state.stateId, {
      attempt: record.attempt,
      status: record.status,
      record,
    });
    context.latestByState.set(record.state.stateId, record);
    context.openStateId = undefined;
  }
  if (record.status !== "PASS") return;
  if (context.passRecords.has(record.state.stateId))
    context.issues.push(`duplicate terminal PASS for ${record.state.stateId}`);
  context.passRecords.set(
    record.state.stateId,
    record as PreflightJournalPassRecord,
  );
};

const applyAttemptRecord = (
  context: ValidationContext,
  record: PreflightJournalRecord,
): void => {
  if (record.event === "started") applyStartedAttempt(context, record);
  else applyTerminalAttempt(context, record);
};

export function validatePreflightJournal(input: {
  readonly source: SourceArtifact;
  readonly assignmentDigest: string;
  readonly records: readonly PreflightJournalRecord[];
}): PreflightJournalValidation {
  const context: ValidationContext = {
    issues: [
      ...(sha256DigestSchema.safeParse(input.assignmentDigest).success
        ? []
        : ["assignment digest is not a SHA-256 digest"]),
    ],
    attempts: new Map(),
    latestByState: new Map(),
    passRecords: new Map(),
    previousDigest: null,
    previousSequence: 0,
    previousPlanIndex: -1,
    openStateId: undefined,
  };
  const expected = expectedJournalStateFor(input.source);
  const expectedById = new Map(
    expected.map((entry) => [entry.state.stateId, entry]),
  );
  input.records.forEach((record, index) => {
    try {
      const parsed = parsePreflightJournalRecord(record);
      if (
        structuralIssuesFor({
          record: parsed,
          source: input.source,
          assignmentDigest: input.assignmentDigest,
          expectedById,
          context,
        })
      )
        applyAttemptRecord(context, parsed);
    } catch (error: unknown) {
      context.issues.push(`record ${index + 1}: ${errorMessage(error)}`);
    }
  });
  if (context.issues.length > 0)
    throw new PreflightJournalValidationError(context.issues);
  return freezeDeep({
    records: input.records,
    latestByState: context.latestByState,
    passRecords: context.passRecords,
    stateAttempts: context.attempts,
  });
}
