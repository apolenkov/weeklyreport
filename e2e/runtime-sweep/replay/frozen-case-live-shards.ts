import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import type { RouteBindingTarget } from "../source/contracts.ts";
import { stableSerialize } from "../support/ids.ts";
import type { ResolverOutcomeExpectation } from "../support/resolver-outcome-expectations.ts";
import {
  buildStatePreparationPlan,
  type StatePreparationPlan,
} from "../support/state-preparation.ts";
import type { FrozenCaseCoverageCell } from "./frozen-case-evidence.ts";

export const MAX_FROZEN_CASE_LIVE_SHARD_CASES = 32;

export type FrozenCaseLiveShard = Readonly<{
  readonly shardIndex: number;
  readonly shardCount: number;
  readonly cases: readonly MatrixExecutableCase[];
  readonly caseIds: readonly string[];
}>;

export type FrozenCaseGroup = readonly MatrixExecutableCase[];

export type FrozenCasePreparationRoute = Readonly<
  | {
      readonly kind?: "unconditional";
      readonly role: MatrixExecutableCase["role"];
      readonly catalogRoute: string;
      readonly resolvedRoute: string;
      readonly landingRoute?: string;
      readonly target: RouteBindingTarget;
      readonly expectedOutcome?: undefined;
    }
  | {
      readonly kind: "resolver";
      readonly role: MatrixExecutableCase["role"];
      readonly catalogRoute: string;
      readonly resolvedRoute: string;
      readonly landingRoute?: never;
      readonly target: RouteBindingTarget;
      readonly expectedOutcome: ResolverOutcomeExpectation;
    }
>;

export const isReusableFrozenCase = (
  matrixCase: MatrixExecutableCase,
): boolean => {
  if (matrixCase.state.fault !== "none") return false;
  if (matrixCase.execution.kind === "navigation") return true;
  if (matrixCase.execution.kind === "idle") return true;
  return (
    matrixCase.execution.kind === "control" &&
    matrixCase.execution.action.safety === "read-only"
  );
};

export const buildFrozenCasePreparationPlan = (
  matrixCase: MatrixExecutableCase,
  route: FrozenCasePreparationRoute,
  repoRoot: string,
): StatePreparationPlan =>
  buildStatePreparationPlan({
    profile: matrixCase.profile,
    routeRole: route.role,
    routeTarget: route.target,
    routeKey: `${route.role}:${route.catalogRoute}`,
    axes: {
      lifecycle: matrixCase.state.lifecycle,
      submission: matrixCase.state.submission,
      ownership: matrixCase.state.ownershipDensity,
      permission: matrixCase.state.permission,
    },
    repoRoot,
  });

export const frozenCasePreparationKey = (
  matrixCase: MatrixExecutableCase,
  route: FrozenCasePreparationRoute,
  repoRoot: string,
): string =>
  stableSerialize({
    sourceSha: matrixCase.sourceSha,
    profileCapability: matrixCase.state.profileCapability,
    fault: matrixCase.state.fault,
    controlTransition: matrixCase.state.controlTransition,
    route: {
      role: route.role,
      catalogRoute: route.catalogRoute,
      resolvedRoute: route.resolvedRoute,
      ...(route.kind === undefined ? {} : { kind: route.kind }),
      ...(route.landingRoute === undefined
        ? {}
        : { landingRoute: route.landingRoute }),
      target: route.target,
      ...(route.expectedOutcome === undefined
        ? {}
        : { expectedOutcome: route.expectedOutcome }),
    },
    repoRoot,
    planDigest: buildFrozenCasePreparationPlan(matrixCase, route, repoRoot)
      .digest,
  });

export const selectFrozenCasesForReplay = (
  cases: readonly MatrixExecutableCase[],
  requestedCaseIds: string | readonly string[] | undefined,
): readonly MatrixExecutableCase[] => {
  if (requestedCaseIds === undefined) return cases;
  const ids =
    typeof requestedCaseIds === "string"
      ? requestedCaseIds.split(",").map((caseId) => caseId.trim())
      : [...requestedCaseIds];
  if (ids.includes(""))
    throw new Error("RUNTIME_SWEEP_CASE_IDS contains an empty case id");
  if (new Set(ids).size !== ids.length)
    throw new Error("RUNTIME_SWEEP_CASE_IDS contains duplicate case ids");
  const requested = new Set(ids);
  const selected = cases.filter(({ caseId }) => requested.has(caseId));
  if (selected.length !== ids.length) {
    const available = new Set(cases.map(({ caseId }) => caseId));
    const missing = ids.filter((caseId) => !available.has(caseId));
    throw new Error(
      `RUNTIME_SWEEP_CASE_IDS contains unknown profile case ids: ${missing.join(", ")}`,
    );
  }
  return selected;
};

export const groupFrozenCases = (
  cases: readonly MatrixExecutableCase[],
  groupKeyFor: (matrixCase: MatrixExecutableCase) => string,
): readonly FrozenCaseGroup[] => {
  const keyed = cases.map((matrixCase) => ({
    key: groupKeyFor(matrixCase),
    matrixCase,
  }));
  const keys = [...new Set(keyed.map(({ key }) => key))];
  return keys.map((key) =>
    keyed
      .filter((candidate) => candidate.key === key)
      .map(({ matrixCase }) => matrixCase),
  );
};

export const restoreFrozenCaseOrder = (
  cases: readonly MatrixExecutableCase[],
  cells: readonly FrozenCaseCoverageCell[],
): readonly FrozenCaseCoverageCell[] => {
  const byId = new Map(cells.map((cell) => [cell.cellId, cell] as const));
  return cases.map((matrixCase) => {
    const cell = byId.get(matrixCase.caseId);
    if (cell === undefined)
      throw new Error(`Frozen case ${matrixCase.caseId} produced no cell`);
    return cell;
  });
};

export const createFrozenCaseLiveShardPlan = (
  cases: readonly MatrixExecutableCase[],
): readonly FrozenCaseLiveShard[] => {
  const shardCount = Math.ceil(cases.length / MAX_FROZEN_CASE_LIVE_SHARD_CASES);
  return Array.from({ length: shardCount }, (_, shardIndex) => {
    const shardCases = cases.slice(
      shardIndex * MAX_FROZEN_CASE_LIVE_SHARD_CASES,
      (shardIndex + 1) * MAX_FROZEN_CASE_LIVE_SHARD_CASES,
    );
    return {
      shardIndex,
      shardCount,
      cases: shardCases,
      caseIds: shardCases.map(({ caseId }) => caseId),
    };
  });
};
