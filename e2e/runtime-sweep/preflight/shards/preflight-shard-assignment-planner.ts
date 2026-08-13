import { assertSpecializedDeclarations } from "../../matrix/specialized/specialized-declarations.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import { sha256Hex, stableSerialize } from "../../support/ids.ts";
import { routeForState } from "../execution/playwright-preflight-support.ts";
import {
  journalStateSchema,
  preflightJournalStateDigest,
  routeIdentityFor,
} from "../journal/preflight-journal-contract.ts";
import { preflightSessionGroupKey } from "../runtime/preflight-session.ts";
import {
  type AssignmentIdentity,
  logicalShardIdFor,
  PREFLIGHT_SHARD_ASSIGNMENT_ARTIFACT,
  PREFLIGHT_SHARD_ASSIGNMENT_VERSION,
  PREFLIGHT_SHARD_ASSIGNMENT_WEIGHTING,
  type PreflightShard,
  type PreflightShardAssignment,
  PreflightShardAssignmentError,
  type PreflightShardState,
} from "./preflight-shard-assignment-contract.ts";
import {
  compareShardStatePlanIndex,
  parsePreflightShardAssignment,
  uniqueStrings,
} from "./preflight-shard-assignment-validation.ts";

const stateIdentityFor = (
  source: SourceArtifact,
  state: SourceArtifact["plan"]["states"][number],
  planIndex: number,
): PreflightShardState => {
  const route = routeForState(source, state);
  const routeIdentity = routeIdentityFor(source, state);
  const journalState = journalStateSchema.parse({
    stateId: state.stateId,
    pairwiseDigest: state.pairwiseDigest,
    profile: state.profile,
    axes: state.axes,
  });
  return {
    planIndex,
    state: journalState,
    stateDigest: preflightJournalStateDigest({
      state: journalState,
      ...routeIdentity,
    }),
    role: route.role,
    catalogRoute: route.catalogRoute,
    resolvedRoute: route.resolvedRoute,
    groupKey: preflightSessionGroupKey(state, route),
  };
};

const sourceStatesFor = (
  source: SourceArtifact,
): readonly PreflightShardState[] =>
  source.plan.states.map((state, planIndex) =>
    stateIdentityFor(source, state, planIndex),
  );

type MutableShard = Readonly<{
  readonly shardIndex: number;
  readonly states: readonly PreflightShardState[];
  readonly totalWeight: number;
}>;

const groupsFor = (
  states: readonly PreflightShardState[],
): readonly (readonly PreflightShardState[])[] => {
  const grouped = new Map<string, PreflightShardState[]>();
  states.forEach((state) => {
    const group = grouped.get(state.groupKey) ?? [];
    grouped.set(state.groupKey, [...group, state]);
  });
  return [...grouped.values()].toSorted((left, right) => {
    const leftFirst = left[0]?.planIndex ?? Number.MAX_SAFE_INTEGER;
    const rightFirst = right[0]?.planIndex ?? Number.MAX_SAFE_INTEGER;
    return leftFirst - rightFirst;
  });
};

const leastLoadedShard = (shards: readonly MutableShard[]): MutableShard => {
  const first = shards[0];
  if (first === undefined)
    throw new PreflightShardAssignmentError(
      "Cannot assign a group without at least one shard",
    );
  return shards
    .slice(1)
    .reduce(
      (best, candidate) =>
        candidate.totalWeight < best.totalWeight ||
        (candidate.totalWeight === best.totalWeight &&
          candidate.shardIndex < best.shardIndex)
          ? candidate
          : best,
      first,
    );
};

const assignGroups = (
  states: readonly PreflightShardState[],
  shardCount: number,
): readonly MutableShard[] => {
  const initial = Array.from({ length: shardCount }, (_, shardIndex) => ({
    shardIndex,
    states: [] as readonly PreflightShardState[],
    totalWeight: 0,
  }));
  return groupsFor(states).reduce((shards, group) => {
    const target = leastLoadedShard(shards);
    return shards.map((shard) =>
      shard.shardIndex === target.shardIndex
        ? {
            ...shard,
            states: [...shard.states, ...group],
            totalWeight: shard.totalWeight + group.length,
          }
        : shard,
    );
  }, initial);
};

const shardFor = (
  identity: AssignmentIdentity,
  shardIndex: number,
  states: readonly PreflightShardState[],
): PreflightShard => {
  const orderedStates = states.toSorted(compareShardStatePlanIndex);
  const body = {
    logicalShardId: logicalShardIdFor(identity, shardIndex),
    shardIndex,
    states: orderedStates,
    groupKeys: uniqueStrings(orderedStates.map(({ groupKey }) => groupKey)),
    // v1 deliberately uses only the number of source-visible nominal states.
    // It never consults timing, archive size, browser work, or runtime output.
    totalWeight: orderedStates.length,
  } as const;
  return { ...body, shardDigest: sha256Hex(body) };
};

const identityFor = (source: SourceArtifact, shardCount: number) => ({
  artifact: PREFLIGHT_SHARD_ASSIGNMENT_ARTIFACT,
  version: PREFLIGHT_SHARD_ASSIGNMENT_VERSION,
  mode: "sharded" as const,
  weighting: PREFLIGHT_SHARD_ASSIGNMENT_WEIGHTING,
  sourceSha: source.sourceSha,
  sourceTree: source.sourceTree,
  treeDigest: source.treeDigest,
  sourceDigest: source.sourceDigest,
  planDigest: source.plan.digest,
  shardCount,
});

export function createPreflightShardAssignment(
  source: SourceArtifact,
  shardCount: number,
): PreflightShardAssignment {
  if (!Number.isInteger(shardCount) || shardCount <= 0)
    throw new PreflightShardAssignmentError(
      "PREFLIGHT_SHARD_ASSIGNMENT shard count must be a positive integer",
    );
  assertSpecializedDeclarations(source.specializedDeclarations);
  const states = sourceStatesFor(source);
  const identity = identityFor(source, shardCount);
  const shards = assignGroups(states, shardCount).map(
    ({ shardIndex, states: shardStates }) =>
      shardFor(identity, shardIndex, shardStates),
  );
  const body = {
    ...identity,
    states,
    specializedDeclarationIds: source.specializedDeclarations.map(
      ({ declarationId }) => declarationId,
    ),
    shards,
  } as const;
  return parsePreflightShardAssignment({
    ...body,
    assignmentDigest: sha256Hex(body),
  });
}

const assertIdentityMatchesSource = (
  source: SourceArtifact,
  assignment: PreflightShardAssignment,
): void => {
  const checks: readonly [string, boolean][] = [
    ["source SHA", assignment.sourceSha === source.sourceSha],
    ["source tree", assignment.sourceTree === source.sourceTree],
    ["tree digest", assignment.treeDigest === source.treeDigest],
    ["source digest", assignment.sourceDigest === source.sourceDigest],
    ["plan digest", assignment.planDigest === source.plan.digest],
  ];
  const mismatch = checks.find(([, matches]) => !matches);
  if (mismatch !== undefined)
    throw new PreflightShardAssignmentError(
      `PREFLIGHT_SHARD_ASSIGNMENT ${mismatch[0]} does not match SOURCE.json`,
    );
};

const assertSpecializedIdsMatchSource = (
  source: SourceArtifact,
  assignment: PreflightShardAssignment,
): void => {
  const expected = source.specializedDeclarations.map(
    ({ declarationId }) => declarationId,
  );
  const actual = assignment.specializedDeclarationIds;
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((id) => !actualSet.has(id));
  const unknown = actual.filter((id) => !expectedSet.has(id));
  if (missing.length > 0 || unknown.length > 0)
    throw new PreflightShardAssignmentError(
      `PREFLIGHT_SHARD_ASSIGNMENT specialized declaration set does not match SOURCE.json (missing: ${missing.join(",") || "none"}; unknown: ${unknown.join(",") || "none"})`,
    );
  if (stableSerialize(expected) !== stableSerialize(actual))
    throw new PreflightShardAssignmentError(
      "PREFLIGHT_SHARD_ASSIGNMENT specialized declaration order does not match SOURCE.json",
    );
};

export function assertPreflightShardAssignmentMatchesSource(
  source: SourceArtifact,
  assignment: PreflightShardAssignment,
): void {
  const parsed = parsePreflightShardAssignment(assignment);
  assertIdentityMatchesSource(source, parsed);
  assertSpecializedIdsMatchSource(source, parsed);
  const expected = createPreflightShardAssignment(source, parsed.shardCount);
  if (stableSerialize(expected) !== stableSerialize(parsed))
    throw new PreflightShardAssignmentError(
      "PREFLIGHT_SHARD_ASSIGNMENT does not match the current SOURCE.json plan",
    );
}

export const preflightShardStateFor = (
  assignment: PreflightShardAssignment,
  stateId: string,
): PreflightShardState => {
  const state = assignment.states.find(
    ({ state }) => state.stateId === stateId,
  );
  if (state === undefined)
    throw new PreflightShardAssignmentError(
      `PREFLIGHT_SHARD_ASSIGNMENT has no state ${stateId}`,
    );
  return state;
};

export { logicalShardIdFor } from "./preflight-shard-assignment-contract.ts";
