import {
  CANONICAL_ROLES,
  type MatrixExecutionKind,
  type RouteBindingTarget,
  SEED_PROFILES,
} from "./contracts.ts";
import {
  type DriverExecutionLaneSummary,
  type DriverShardAssignment,
  DriverShardError,
  type DriverShardPlan,
  MAX_DRIVER_SHARD_CASES,
} from "./driver-shard-types.ts";
import { sha256Hex, stableId, stableSerialize } from "./ids.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";

const profileOrder = SEED_PROFILES;
const roleOrder = CANONICAL_ROLES;

const orderOf = (order: readonly string[], value: string): number => {
  const index = order.indexOf(value);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

const routeIdentity = (candidate: {
  readonly profile: string;
  readonly role: string;
  readonly catalogRoute: string;
  readonly resolvedRoute: string;
  readonly stateId: string;
}): string =>
  `${candidate.profile}\u0000${candidate.role}\u0000${candidate.catalogRoute}\u0000${candidate.resolvedRoute}\u0000${candidate.stateId}`;

const compareCases = (
  left: MatrixExecutableCase,
  right: MatrixExecutableCase,
): number => left.caseId.localeCompare(right.caseId);

const compareGroups = (left: string, right: string): number => {
  const leftParts = left.split("\u0000");
  const rightParts = right.split("\u0000");
  const profileDifference =
    orderOf(profileOrder, leftParts[0] ?? "") -
    orderOf(profileOrder, rightParts[0] ?? "");
  if (profileDifference !== 0) return profileDifference;
  const roleDifference =
    orderOf(roleOrder, leftParts[1] ?? "") -
    orderOf(roleOrder, rightParts[1] ?? "");
  if (roleDifference !== 0) return roleDifference;
  return left.localeCompare(right);
};

const duplicateValues = (values: readonly string[]): readonly string[] =>
  [
    ...new Set(
      values.filter((value, index) => values.indexOf(value) !== index),
    ),
  ].toSorted((left, right) => left.localeCompare(right));

const assertRouteLocal = (cases: readonly MatrixExecutableCase[]): void => {
  const first = cases[0];
  if (first === undefined)
    throw new DriverShardError("Cannot shard an empty route");
  const mismatches = cases.filter(
    (candidate) =>
      routeIdentity(candidate) !== routeIdentity(first) ||
      stableSerialize(candidate.state) !== stableSerialize(first.state),
  );
  if (mismatches.length > 0)
    throw new DriverShardError(
      "A route-local shard contains mixed case identity",
    );
};

const countKind = (
  cases: readonly MatrixExecutableCase[],
  kind: MatrixExecutionKind,
): number => cases.filter(({ execution }) => execution.kind === kind).length;

const laneFor = (
  cases: readonly MatrixExecutableCase[],
): DriverExecutionLaneSummary => {
  const kinds = [
    ...new Set(cases.map(({ execution }) => execution.kind)),
  ].toSorted((left, right) => left.localeCompare(right));
  const transitions = [
    ...new Set(
      cases.map((candidate) =>
        "action" in candidate.execution
          ? candidate.execution.action.transition
          : "observation",
      ),
    ),
  ].toSorted((left, right) => left.localeCompare(right));
  const actionCount = cases.filter(
    ({ execution }) => "action" in execution,
  ).length;
  const observationCount = cases.length - actionCount;
  const summary = kinds
    .map((kind) => `${kind}:${countKind(cases, kind)}`)
    .join(",");
  return {
    caseCount: cases.length,
    actionCount,
    observationCount,
    kinds,
    transitions,
    summary,
  };
};

const makeShard = (
  cases: readonly MatrixExecutableCase[],
  routeTarget: RouteBindingTarget,
  shardIndex: number,
  shardCount: number,
): DriverShardAssignment => {
  assertRouteLocal(cases);
  const first = cases[0];
  if (first === undefined)
    throw new DriverShardError("Cannot create an empty shard");
  const caseIds = cases.map(({ caseId }) => caseId);
  const executionLane = laneFor(cases);
  const identity = {
    sourceSha: first.sourceSha,
    profile: first.profile,
    role: first.role,
    catalogRoute: first.catalogRoute,
    resolvedRoute: first.resolvedRoute,
    routeTarget,
    stateId: first.stateId,
    state: first.state,
    caseIds,
    executionLane,
  };
  return {
    shardId: stableId("driver-shard", identity),
    shardIndex,
    shardCount,
    digest: sha256Hex(identity),
    ...identity,
  };
};

const routeGroups = (
  cases: readonly MatrixExecutableCase[],
): readonly (readonly MatrixExecutableCase[])[] => {
  const keys = [...new Set(cases.map(routeIdentity))].toSorted(compareGroups);
  return keys.map((key) =>
    cases
      .filter((candidate) => routeIdentity(candidate) === key)
      .toSorted(compareCases),
  );
};

const shardsForRoute = (
  cases: readonly MatrixExecutableCase[],
  routeTarget: RouteBindingTarget,
): readonly DriverShardAssignment[] => {
  assertRouteLocal(cases);
  const duplicateIds = duplicateValues(cases.map(({ caseId }) => caseId));
  if (duplicateIds.length > 0)
    throw new DriverShardError(
      `Duplicate finalized case id: ${duplicateIds.join(", ")}`,
    );
  const ordered = cases.toSorted(compareCases);
  const shardCount = Math.ceil(ordered.length / MAX_DRIVER_SHARD_CASES);
  return Array.from({ length: shardCount }, (_, shardIndex) =>
    makeShard(
      ordered.slice(
        shardIndex * MAX_DRIVER_SHARD_CASES,
        (shardIndex + 1) * MAX_DRIVER_SHARD_CASES,
      ),
      routeTarget,
      shardIndex,
      shardCount,
    ),
  );
};

export function createDriverShardPlan(
  cases: readonly MatrixExecutableCase[],
  routeTarget: RouteBindingTarget,
): DriverShardPlan {
  const duplicateIds = duplicateValues(cases.map(({ caseId }) => caseId));
  if (duplicateIds.length > 0)
    throw new DriverShardError(
      `Duplicate finalized case id: ${duplicateIds.join(", ")}`,
    );
  const assignments = routeGroups(cases).flatMap((routeCases) =>
    shardsForRoute(routeCases, routeTarget),
  );
  return { assignments, totalShards: assignments.length };
}
