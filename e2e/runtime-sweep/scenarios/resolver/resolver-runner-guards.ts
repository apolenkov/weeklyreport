import { isDeepStrictEqual } from "node:util";

import type { ResolverOutcomeExpectation } from "../../support/resolver-outcome-expectations.ts";
import {
  observeRuntimeDatabase,
  type RuntimeDatabaseSnapshot,
  type RuntimeDomainOracle,
  type RuntimeOracleObservation,
} from "../../support/state-oracle.ts";
import type {
  PermissionSubject,
  RuntimeMutationSentinel,
  ViewerGroupAccessGrant,
} from "../../support/state-preparation.ts";

const RESOLVER_URL_BASE = "https://runtime-sweep.invalid";

export type ResolverRecoveryOutcome = Readonly<{
  readonly reportId: string | null;
}>;

export class ResolverPreparationMismatchError extends Error {
  override readonly name = "ResolverPreparationMismatchError";
}

type PreparedEmptyResolverState = Readonly<{
  readonly plan: Readonly<{
    readonly routeRole: string;
    readonly permission: PermissionSubject;
    readonly oracle: RuntimeDomainOracle;
  }>;
  readonly actual: RuntimeDatabaseSnapshot;
  readonly observation: RuntimeOracleObservation;
  readonly mutationSentinel: RuntimeMutationSentinel;
  readonly mutation: Readonly<{
    readonly viewerUserId: string;
    readonly viewerAccessBefore: readonly ViewerGroupAccessGrant[];
    readonly viewerAccessAfter: readonly ViewerGroupAccessGrant[];
    readonly removedCount: number;
    readonly mutationSentinelBefore: RuntimeMutationSentinel;
    readonly mutationSentinelAfter: RuntimeMutationSentinel;
  }>;
}>;

const expectedEmptyPermissionTransition = (
  observation: RuntimeOracleObservation,
): boolean =>
  observation.mismatches.length === 1 &&
  observation.mismatches[0]?.axis === "permission" &&
  observation.mismatches[0].field === "allowed" &&
  observation.mismatches[0].expected === true &&
  observation.mismatches[0].actual === false;

const baseEmptyViolations = (
  prepared: PreparedEmptyResolverState,
): readonly string[] => {
  const violations: string[] = [];
  if (prepared.plan.routeRole !== "viewer")
    violations.push("routeRole must be viewer");
  if (prepared.plan.permission.boundary !== "allowed")
    violations.push("base permission boundary must be allowed");
  if (prepared.plan.permission.actorId !== prepared.mutation.viewerUserId)
    violations.push("permission actor must equal the mutated viewer");
  if (!expectedEmptyPermissionTransition(prepared.observation))
    violations.push(
      `base observation must contain only allowed true->false=${JSON.stringify(prepared.observation.mismatches)}`,
    );
  return violations;
};

const specializedDomainViolations = (
  prepared: PreparedEmptyResolverState,
): readonly string[] => {
  const specializedOracle: RuntimeDomainOracle = {
    ...prepared.plan.oracle,
    permission: { ...prepared.plan.oracle.permission, allowed: false },
  };
  const observation = observeRuntimeDatabase(
    specializedOracle,
    prepared.actual,
  );
  return observation.matches
    ? []
    : [`specialized domain mismatch=${JSON.stringify(observation.mismatches)}`];
};

const actualPermissionViolations = (
  prepared: PreparedEmptyResolverState,
): readonly string[] => {
  const violations: string[] = [];
  const { actual, mutation } = prepared;
  if (actual.permission.actorId !== mutation.viewerUserId)
    violations.push("actual permission actor does not match the viewer");
  if (actual.permission.actorRole !== "viewer")
    violations.push("actual permission role must be viewer");
  if (!actual.permission.authenticated)
    violations.push("empty resolver viewer must remain authenticated");
  if (actual.permission.allowed)
    violations.push("empty resolver viewer must not retain report access");
  return violations;
};

const grantViolations = (
  prepared: PreparedEmptyResolverState,
): readonly string[] => {
  const violations: string[] = [];
  const { mutation, plan } = prepared;
  if (mutation.viewerAccessBefore.length === 0)
    violations.push("viewerAccessBefore must contain a seeded grant");
  if (mutation.viewerAccessAfter.length > 0)
    violations.push("viewerAccessAfter must be empty");
  if (mutation.removedCount !== mutation.viewerAccessBefore.length)
    violations.push("removedCount must equal viewerAccessBefore length");
  const grantIds = mutation.viewerAccessBefore.map(({ id }) => id);
  if (new Set(grantIds).size !== grantIds.length)
    violations.push("viewerAccessBefore contains duplicate grant ids");
  if (
    mutation.viewerAccessBefore.some(
      ({ viewerUserId }) => viewerUserId !== mutation.viewerUserId,
    )
  )
    violations.push("viewerAccessBefore contains a foreign viewer grant");
  if (
    !mutation.viewerAccessBefore.some(
      ({ groupId }) => groupId === plan.permission.groupId,
    )
  )
    violations.push(
      "viewerAccessBefore lacks the target reporting-group grant",
    );
  return violations;
};

const sentinelViolations = (
  prepared: PreparedEmptyResolverState,
): readonly string[] => {
  const violations: string[] = [];
  if (
    !isDeepStrictEqual(
      prepared.mutation.mutationSentinelBefore,
      prepared.mutation.mutationSentinelAfter,
    )
  )
    violations.push("grant removal changed mutation sentinels");
  if (
    !isDeepStrictEqual(
      prepared.mutationSentinel,
      prepared.mutation.mutationSentinelAfter,
    )
  )
    violations.push("prepared mutation sentinel is stale");
  return violations;
};

/**
 * Validates the route-local empty resolver state after its atomic grant
 * removal. The base state remains an authenticated allowed viewer state, but
 * the specialized post-mutation oracle explicitly expects access=false.
 */
export const assertPreparedEmptyResolverState = (
  prepared: PreparedEmptyResolverState,
): void => {
  const violations = [
    ...baseEmptyViolations(prepared),
    ...specializedDomainViolations(prepared),
    ...actualPermissionViolations(prepared),
    ...grantViolations(prepared),
    ...sentinelViolations(prepared),
  ];

  if (violations.length > 0)
    throw new ResolverPreparationMismatchError(
      `Empty resolver preparation mismatch: ${violations.join("; ")}`,
    );
};

export const assertPreparedResolverState = (
  prepared: Readonly<{
    readonly observation: Readonly<{
      readonly matches: boolean;
      readonly mismatches: readonly unknown[];
    }>;
  }>,
  label: string,
): void => {
  if (prepared.observation.matches) return;
  throw new ResolverPreparationMismatchError(
    `${label} preparation mismatch: ${JSON.stringify(prepared.observation.mismatches)}`,
  );
};

const normalizedResolverUrl = (value: string): string => {
  const url = new URL(value, RESOLVER_URL_BASE);
  return `${url.pathname}${url.search}${url.hash}`;
};

const expectedReportIdFor = (
  expected: ResolverOutcomeExpectation | undefined,
): string => {
  if (expected === undefined)
    throw new Error("Resolver recovery requires a frozen expected outcome");
  const expectedTarget = normalizedResolverUrl(expected.expectedTarget);
  const expectedPath = new URL(expectedTarget, RESOLVER_URL_BASE).pathname;
  const reportPath = /^\/reports\/([^/]+)$/u.exec(expectedPath);
  if (reportPath?.[1] === undefined)
    throw new Error(
      `Resolver recovery expectation is not a report detail target: ${expectedTarget}`,
    );
  return reportPath[1];
};

export const assertResolverReportId = (
  expected: ResolverOutcomeExpectation | undefined,
  actual: ResolverRecoveryOutcome,
): string => {
  const expectedReportId = expectedReportIdFor(expected);
  if (actual.reportId !== expectedReportId)
    throw new Error(
      `Resolver report mismatch: expected=${expectedReportId} actual=${actual.reportId ?? "null"}`,
    );
  return expectedReportId;
};

/**
 * Proves both halves of a resolver recovery: the frozen report identity and
 * the complete normalized landing pathname/query. A generic non-null report
 * or a pathname-only match is insufficient evidence.
 */
export const assertResolverRecovery = (
  expected: ResolverOutcomeExpectation | undefined,
  actual: ResolverRecoveryOutcome,
  actualUrl: string,
): string => {
  const expectedReportId = expectedReportIdFor(expected);
  const expectedTarget = normalizedResolverUrl(expected?.expectedTarget ?? "");
  const actualTarget = normalizedResolverUrl(actualUrl);
  const mismatches: string[] = [];
  if (actual.reportId !== expectedReportId)
    mismatches.push(
      `reportId expected=${expectedReportId} actual=${actual.reportId ?? "null"}`,
    );
  if (actualTarget !== expectedTarget)
    mismatches.push(`target expected=${expectedTarget} actual=${actualTarget}`);
  if (mismatches.length > 0)
    throw new Error(`Resolver recovery mismatch: ${mismatches.join("; ")}`);
  return actualTarget;
};
