import { freezeDeep } from "../../source/manifest-source.ts";
import { sha256Hex, stableSerialize } from "../../support/ids.ts";
import {
  errorMessage,
  preflightJournalStateDigest,
} from "../journal/preflight-journal-contract.ts";
import {
  logicalShardIdFor,
  type PreflightShard,
  type PreflightShardAssignment,
  PreflightShardAssignmentError,
  preflightShardAssignmentSchema,
  type PreflightShardState,
} from "./preflight-shard-assignment-contract.ts";

const assignmentBodyFor = (
  assignment: PreflightShardAssignment,
): Omit<PreflightShardAssignment, "assignmentDigest"> => {
  const { assignmentDigest: _assignmentDigest, ...body } = assignment;
  return body;
};

const shardBodyFor = (
  shard: PreflightShard,
): Omit<PreflightShard, "shardDigest"> => {
  const { shardDigest: _shardDigest, ...body } = shard;
  return body;
};

export const uniqueStrings = (values: readonly string[]): readonly string[] =>
  values.filter((value, index) => values.indexOf(value) === index);

export const compareShardStatePlanIndex = (
  left: PreflightShardState,
  right: PreflightShardState,
): number => left.planIndex - right.planIndex;

const duplicateValues = (values: readonly string[]): readonly string[] =>
  values.filter((value, index) => values.indexOf(value) !== index);

const assertStateDigest = (state: PreflightShardState, label: string): void => {
  const expected = preflightJournalStateDigest({
    state: state.state,
    role: state.role,
    catalogRoute: state.catalogRoute,
    resolvedRoute: state.resolvedRoute,
  });
  if (expected !== state.stateDigest)
    throw new PreflightShardAssignmentError(
      `${label} state digest does not match its payload`,
    );
};

const assertGlobalStates = (assignment: PreflightShardAssignment): void => {
  const stateIds = assignment.states.map(({ state }) => state.stateId);
  const duplicate = duplicateValues(stateIds).at(0);
  if (duplicate !== undefined)
    throw new PreflightShardAssignmentError(
      `PREFLIGHT_SHARD_ASSIGNMENT contains duplicate global state ${duplicate}`,
    );
  assignment.states.forEach((state, expectedPlanIndex) => {
    if (state.planIndex !== expectedPlanIndex)
      throw new PreflightShardAssignmentError(
        `PREFLIGHT_SHARD_ASSIGNMENT global state ${state.state.stateId} is reordered`,
      );
    assertStateDigest(
      state,
      `PREFLIGHT_SHARD_ASSIGNMENT global state ${state.state.stateId}`,
    );
  });
};

const assertShardHeader = (
  assignment: PreflightShardAssignment,
  shard: PreflightShard,
  expectedShardIndex: number,
): void => {
  if (shard.shardIndex !== expectedShardIndex)
    throw new PreflightShardAssignmentError(
      "PREFLIGHT_SHARD_ASSIGNMENT shard indices are duplicated or reordered",
    );
  if (shard.states.length === 0)
    throw new PreflightShardAssignmentError(
      `PREFLIGHT_SHARD_ASSIGNMENT shard ${shard.shardIndex} is empty; every shard must own one complete group`,
    );
  const expectedLogicalId = logicalShardIdFor(assignment, shard.shardIndex);
  if (shard.logicalShardId !== expectedLogicalId)
    throw new PreflightShardAssignmentError(
      `PREFLIGHT_SHARD_ASSIGNMENT logical shard id drifted for index ${shard.shardIndex}`,
    );
  const orderedStates = shard.states.toSorted(compareShardStatePlanIndex);
  if (stableSerialize(orderedStates) !== stableSerialize(shard.states))
    throw new PreflightShardAssignmentError(
      `PREFLIGHT_SHARD_ASSIGNMENT shard ${shard.shardIndex} states are not in increasing plan order`,
    );
  if (shard.totalWeight !== shard.states.length)
    throw new PreflightShardAssignmentError(
      `PREFLIGHT_SHARD_ASSIGNMENT shard ${shard.shardIndex} weight is not its state count`,
    );
  const expectedGroupKeys = uniqueStrings(
    shard.states.map(({ groupKey }) => groupKey),
  );
  if (stableSerialize(expectedGroupKeys) !== stableSerialize(shard.groupKeys))
    throw new PreflightShardAssignmentError(
      `PREFLIGHT_SHARD_ASSIGNMENT shard ${shard.shardIndex} group keys do not match its states`,
    );
  const duplicate = duplicateValues(shard.groupKeys).at(0);
  if (duplicate !== undefined)
    throw new PreflightShardAssignmentError(
      `PREFLIGHT_SHARD_ASSIGNMENT shard ${shard.shardIndex} contains duplicate group key ${duplicate}`,
    );
};

type ShardStateValidation = Readonly<{
  readonly globalByPlanIndex: ReadonlyMap<number, PreflightShardState>;
  readonly assignedByPlanIndex: Map<number, number>;
  readonly groupShardIndices: Map<string, number>;
}>;

const assertShardState = (
  shard: PreflightShard,
  state: PreflightShardState,
  validation: ShardStateValidation,
): void => {
  assertStateDigest(
    state,
    `PREFLIGHT_SHARD_ASSIGNMENT shard ${shard.shardIndex} state ${state.state.stateId}`,
  );
  const global = validation.globalByPlanIndex.get(state.planIndex);
  if (global === undefined)
    throw new PreflightShardAssignmentError(
      `PREFLIGHT_SHARD_ASSIGNMENT shard ${shard.shardIndex} contains a foreign plan index ${state.planIndex}`,
    );
  if (stableSerialize(global) !== stableSerialize(state))
    throw new PreflightShardAssignmentError(
      `PREFLIGHT_SHARD_ASSIGNMENT shard ${shard.shardIndex} state payload does not match the global state`,
    );
  if (validation.assignedByPlanIndex.has(state.planIndex))
    throw new PreflightShardAssignmentError(
      `PREFLIGHT_SHARD_ASSIGNMENT assigns plan index ${state.planIndex} more than once`,
    );
  validation.assignedByPlanIndex.set(state.planIndex, shard.shardIndex);
  const priorShardIndex = validation.groupShardIndices.get(state.groupKey);
  if (priorShardIndex !== undefined && priorShardIndex !== shard.shardIndex)
    throw new PreflightShardAssignmentError(
      `PREFLIGHT_SHARD_ASSIGNMENT splits session group ${state.groupKey}`,
    );
  validation.groupShardIndices.set(state.groupKey, shard.shardIndex);
};

const assertShardRecord = (
  assignment: PreflightShardAssignment,
  shard: PreflightShard,
  expectedShardIndex: number,
  validation: ShardStateValidation,
): void => {
  assertShardHeader(assignment, shard, expectedShardIndex);
  shard.states.forEach((state) => assertShardState(shard, state, validation));
  if (sha256Hex(shardBodyFor(shard)) !== shard.shardDigest)
    throw new PreflightShardAssignmentError(
      `PREFLIGHT_SHARD_ASSIGNMENT shard ${shard.shardIndex} digest does not match its contents`,
    );
};

const assertShardRecords = (assignment: PreflightShardAssignment): void => {
  if (assignment.shards.length !== assignment.shardCount)
    throw new PreflightShardAssignmentError(
      "PREFLIGHT_SHARD_ASSIGNMENT shard count does not match shard records",
    );
  const validation: ShardStateValidation = {
    globalByPlanIndex: new Map(
      assignment.states.map((state) => [state.planIndex, state] as const),
    ),
    assignedByPlanIndex: new Map(),
    groupShardIndices: new Map(),
  };
  assignment.shards.forEach((shard, expectedShardIndex) =>
    assertShardRecord(assignment, shard, expectedShardIndex, validation),
  );
  const missing = assignment.states.find(
    (state) => !validation.assignedByPlanIndex.has(state.planIndex),
  );
  if (missing !== undefined)
    throw new PreflightShardAssignmentError(
      `PREFLIGHT_SHARD_ASSIGNMENT is missing global state ${missing.state.stateId}`,
    );
};

const assertSpecializedIds = (assignment: PreflightShardAssignment): void => {
  const duplicate = duplicateValues(assignment.specializedDeclarationIds).at(0);
  if (duplicate !== undefined)
    throw new PreflightShardAssignmentError(
      `PREFLIGHT_SHARD_ASSIGNMENT contains duplicate specialized declaration ${duplicate}`,
    );
};

export function parsePreflightShardAssignment(
  value: unknown,
): PreflightShardAssignment {
  const assignment = (() => {
    try {
      return preflightShardAssignmentSchema.parse(value);
    } catch (error: unknown) {
      throw new PreflightShardAssignmentError(
        `Invalid PREFLIGHT_SHARD_ASSIGNMENT: ${errorMessage(error)}`,
      );
    }
  })();
  if (sha256Hex(assignmentBodyFor(assignment)) !== assignment.assignmentDigest)
    throw new PreflightShardAssignmentError(
      "PREFLIGHT_SHARD_ASSIGNMENT digest does not match its contents",
    );
  assertSpecializedIds(assignment);
  assertGlobalStates(assignment);
  assertShardRecords(assignment);
  return freezeDeep(assignment);
}
