import { freezeDeep } from "../../../source/manifest-source.ts";
import { stableSerialize } from "../../../support/ids.ts";
import type { PreflightShardState } from "../preflight-shard-assignment.ts";
import {
  assertPreflightShardJournalContext,
  type PreflightShardJournalContext,
} from "./preflight-shard-journal-context.ts";
import {
  parsePreflightShardJournalRecord,
  type PreflightShardJournalIdentity,
  type PreflightShardJournalPassRecord,
  type PreflightShardJournalRecord,
  PreflightShardJournalValidationError,
} from "./preflight-shard-journal-contract.ts";

type PreflightShardJournalAttempt = Readonly<{
  readonly attempt: number;
  readonly status: PreflightShardJournalRecord["status"];
  readonly record: PreflightShardJournalRecord;
}>;

export type PreflightShardJournalValidation = Readonly<{
  readonly records: readonly PreflightShardJournalRecord[];
  readonly identity: PreflightShardJournalIdentity;
  readonly latestByState: ReadonlyMap<string, PreflightShardJournalRecord>;
  readonly candidatePassRecords: ReadonlyMap<
    string,
    PreflightShardJournalPassRecord
  >;
  readonly attemptsByState: ReadonlyMap<string, PreflightShardJournalAttempt>;
}>;

interface ValidationState {
  readonly issues: string[];
  readonly latestByState: Map<string, PreflightShardJournalRecord>;
  readonly passRecords: Map<string, PreflightShardJournalPassRecord>;
  readonly attempts: Map<string, PreflightShardJournalAttempt>;
  previousDigest: string | null;
  previousSequence: number;
  cursor: number;
  currentStateId: string | null;
}

const identityIssues = (
  record: PreflightShardJournalRecord,
  expected: PreflightShardJournalIdentity,
): readonly string[] => {
  const fields = Object.keys(
    expected,
  ) as (keyof PreflightShardJournalIdentity)[];
  return fields
    .filter(
      (field) =>
        stableSerialize(record[field]) !== stableSerialize(expected[field]),
    )
    .map((field) => `record ${record.sequence} has mismatched ${field}`);
};

const stateIssues = (
  record: PreflightShardJournalRecord,
  expected: PreflightShardState,
): readonly string[] => {
  const checks: readonly (readonly [string, boolean])[] = [
    ["plan index", record.planIndex === expected.planIndex],
    [
      "state body",
      stableSerialize(record.state) === stableSerialize(expected.state),
    ],
    ["state digest", record.stateDigest === expected.stateDigest],
    ["role", record.role === expected.role],
    ["catalog route", record.catalogRoute === expected.catalogRoute],
    ["resolved route", record.resolvedRoute === expected.resolvedRoute],
    ["group key", record.groupKey === expected.groupKey],
  ];
  return checks
    .filter(([, matches]) => !matches)
    .map(([field]) => `${record.state.stateId} has mismatched ${field}`);
};

const applyChain = (
  record: PreflightShardJournalRecord,
  state: ValidationState,
): void => {
  if (record.sequence !== state.previousSequence + 1)
    state.issues.push(`record ${record.sequence} is not contiguous`);
  if (record.previousRecordDigest !== state.previousDigest)
    state.issues.push(`record ${record.sequence} has a broken hash chain`);
  state.previousSequence = record.sequence;
  state.previousDigest = record.recordDigest;
};

const canEnterState = (
  record: PreflightShardJournalRecord,
  expectedIndex: number,
  state: ValidationState,
): boolean => {
  if (expectedIndex < state.cursor) {
    state.issues.push(`record ${record.sequence} reorders assigned states`);
    return false;
  }
  if (expectedIndex > state.cursor + 1) {
    state.issues.push(`record ${record.sequence} skips an assigned state`);
    return false;
  }
  if (expectedIndex === state.cursor + 1 && state.cursor >= 0) {
    const current =
      state.currentStateId === null
        ? undefined
        : state.attempts.get(state.currentStateId);
    if (current?.status !== "PASS") {
      state.issues.push(
        `record ${record.sequence} advances past an incomplete state`,
      );
      return false;
    }
  }
  if (expectedIndex === state.cursor + 1) {
    state.cursor = expectedIndex;
    state.currentStateId = record.state.stateId;
  }
  return true;
};

const applyStarted = (
  record: PreflightShardJournalRecord,
  expectedIndex: number,
  state: ValidationState,
): void => {
  if (!canEnterState(record, expectedIndex, state)) return;
  const prior = state.attempts.get(record.state.stateId);
  const expectedAttempt = prior === undefined ? 1 : prior.attempt + 1;
  if (prior?.status === "STARTED")
    state.issues.push(`state ${record.state.stateId} has duplicate STARTED`);
  if (prior?.status === "PASS")
    state.issues.push(`state ${record.state.stateId} starts after PASS`);
  if (record.attempt !== expectedAttempt)
    state.issues.push(
      `state ${record.state.stateId} has attempt ${record.attempt}, expected ${expectedAttempt}`,
    );
  if (prior?.status === "STARTED" || prior?.status === "PASS") return;
  const attempt = { attempt: record.attempt, status: record.status, record };
  state.attempts.set(record.state.stateId, attempt);
  state.latestByState.set(record.state.stateId, record);
};

const applyTerminal = (
  record: PreflightShardJournalRecord,
  expectedIndex: number,
  state: ValidationState,
): void => {
  if (expectedIndex !== state.cursor)
    state.issues.push(`terminal record ${record.sequence} is out of order`);
  const prior = state.attempts.get(record.state.stateId);
  if (prior?.status !== "STARTED") {
    state.issues.push(
      `terminal record ${record.sequence} has no matching STARTED`,
    );
    return;
  }
  if (record.attempt !== prior.attempt) {
    state.issues.push(
      `terminal record ${record.sequence} has mismatched attempt`,
    );
    return;
  }
  const attempt = { attempt: record.attempt, status: record.status, record };
  state.attempts.set(record.state.stateId, attempt);
  state.latestByState.set(record.state.stateId, record);
  if (record.status === "PASS")
    state.passRecords.set(
      record.state.stateId,
      record as PreflightShardJournalPassRecord,
    );
};

const applyRecord = (
  record: PreflightShardJournalRecord,
  expectedIndex: number,
  state: ValidationState,
): void => {
  applyChain(record, state);
  if (record.event === "started") applyStarted(record, expectedIndex, state);
  else applyTerminal(record, expectedIndex, state);
};

export const validatePreflightShardJournal = (input: {
  readonly context: PreflightShardJournalContext;
  readonly records: readonly unknown[];
}): PreflightShardJournalValidation => {
  const identity = assertPreflightShardJournalContext(input.context);
  const expectedById = new Map(
    input.context.shard.states.map((state, index) => [
      state.state.stateId,
      { state, index },
    ]),
  );
  const state: ValidationState = {
    issues: [],
    latestByState: new Map(),
    passRecords: new Map(),
    attempts: new Map(),
    previousDigest: null,
    previousSequence: 0,
    cursor: -1,
    currentStateId: null,
  };
  const records: PreflightShardJournalRecord[] = [];
  input.records.forEach((raw, index) => {
    try {
      const record = parsePreflightShardJournalRecord(raw);
      records.push(record);
      state.issues.push(...identityIssues(record, identity));
      const expected = expectedById.get(record.state.stateId);
      if (expected === undefined) {
        state.issues.push(
          `record ${record.sequence} references a foreign state`,
        );
        applyChain(record, state);
        return;
      }
      state.issues.push(...stateIssues(record, expected.state));
      applyRecord(record, expected.index, state);
    } catch (error: unknown) {
      state.issues.push(
        `record ${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });
  if (state.issues.length > 0)
    throw new PreflightShardJournalValidationError(state.issues);
  return freezeDeep({
    records,
    identity,
    latestByState: state.latestByState,
    candidatePassRecords: state.passRecords,
    attemptsByState: state.attempts,
  });
};

export const resolvePreflightShardJournalCandidates = (input: {
  readonly context: PreflightShardJournalContext;
  readonly records: readonly unknown[];
}): Readonly<{
  readonly candidatePassStateIds: readonly string[];
  readonly rerunStateIds: readonly string[];
  readonly interruptedStateId: string | null;
}> => {
  const validation = validatePreflightShardJournal(input);
  const assignedIds = input.context.shard.states.map(
    ({ state }) => state.stateId,
  );
  const firstRerun = assignedIds.findIndex(
    (stateId) => validation.attemptsByState.get(stateId)?.status !== "PASS",
  );
  const splitAt = firstRerun === -1 ? assignedIds.length : firstRerun;
  const rerunStateIds = assignedIds.slice(splitAt);
  const interrupted = rerunStateIds.find(
    (stateId) => validation.attemptsByState.get(stateId)?.status === "STARTED",
  );
  return freezeDeep({
    candidatePassStateIds: assignedIds.slice(0, splitAt),
    rerunStateIds,
    interruptedStateId: interrupted ?? null,
  });
};
