import {
  ACTIVE_REPORT_ID,
  PUBLISHED_REPORT_ID,
} from "../../../prisma/seeds/support/seed-constants.ts";
import type { CampaignMatrixState } from "../matrix/campaign-matrix.ts";
import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import type {
  CampaignManifest,
  ResolverOutcomeKind,
  RouteBinding,
  RouteDeclaration,
  SeedProfile,
  SourceBoundResolverOutcome,
} from "../source/contracts.ts";
import { sha256Hex, stableSerialize } from "./ids.ts";
import {
  bindResolverOutcomeSourceDigest,
  freezeResolverOutcomeIdentity,
  type ResolverOutcomeExpectationExtension,
} from "./resolver-outcome-contract.ts";
import { stateForMatrixCase } from "./resolver-outcome-matrix-state.ts";

export type ResolverOutcomeExpectation = ResolverOutcomeExpectationExtension & {
  readonly identity: SourceBoundResolverOutcome;
};

export type ResolverOutcomeNotApplicable = Readonly<{
  readonly outcome: ResolverOutcomeKind;
  readonly profile: SeedProfile;
  readonly constraintId: string;
  readonly reason: string;
}>;

export class ResolverOutcomeExpectationError extends Error {
  override readonly name = "ResolverOutcomeExpectationError";
}

const REPORTS_LATEST = "/reports/latest";
const STATUS_QUERY = "source=status&recovery=0";
const VISIBLE_CURRENT_TARGET = `/reports/${ACTIVE_REPORT_ID}?${STATUS_QUERY}`;
const PUBLISHED_FALLBACK_TARGET = `/reports/${PUBLISHED_REPORT_ID}?${STATUS_QUERY}`;
const VISIBLE_CURRENT_OUTCOME = "visible-current" as const;
const PUBLISHED_FALLBACK_OUTCOME = "published-fallback" as const;
const EMPTY_OUTCOME = "empty" as const;
const QUERY_ERROR_OUTCOME = "query-error" as const;
const ANONYMOUS_OUTCOME = "anonymous" as const;

export const resolverExpectedTargetFor = (
  outcome: ResolverOutcomeKind,
): string => {
  switch (outcome) {
    case VISIBLE_CURRENT_OUTCOME:
      return VISIBLE_CURRENT_TARGET;
    case PUBLISHED_FALLBACK_OUTCOME:
      return PUBLISHED_FALLBACK_TARGET;
    case EMPTY_OUTCOME:
    case QUERY_ERROR_OUTCOME:
      return REPORTS_LATEST;
    case ANONYMOUS_OUTCOME:
      return `/?${new URLSearchParams({ next: REPORTS_LATEST }).toString()}`;
    default:
      return assertNever(outcome);
  }
};

const expectedUiFor = (outcome: ResolverOutcomeKind): string => {
  switch (outcome) {
    case VISIBLE_CURRENT_OUTCOME:
    case PUBLISHED_FALLBACK_OUTCOME:
      return "report-detail:Status Report";
    case EMPTY_OUTCOME:
      return "status-empty:There is no report to show yet.";
    case QUERY_ERROR_OUTCOME:
      return "status-query-error:Could not load the status report.;retry=Try again";
    case ANONYMOUS_OUTCOME:
      return "auth-boundary:Status Reporting System";
    default:
      return assertNever(outcome);
  }
};

export const resolverExpectedUiFor = (outcome: ResolverOutcomeKind): string =>
  expectedUiFor(outcome);

export const resolverOutcomeForState = (
  state: CampaignMatrixState,
): ResolverOutcomeKind => {
  if (state.axes.permission === ANONYMOUS_OUTCOME) return ANONYMOUS_OUTCOME;
  switch (state.axes.lifecycle) {
    case "open":
    case "reopened":
      return VISIBLE_CURRENT_OUTCOME;
    case "published":
    case "archived":
      return PUBLISHED_FALLBACK_OUTCOME;
    default:
      return assertNever(state.axes.lifecycle);
  }
};

const BLOCKED_OUTCOMES = [EMPTY_OUTCOME, QUERY_ERROR_OUTCOME] as const;

const assignedResolverBindingFor = (
  route: Extract<RouteDeclaration, { readonly kind: "resolver" }>,
  profile: SeedProfile,
): Extract<
  RouteBinding,
  { readonly status: "assigned"; readonly kind: "resolver" }
> => {
  const binding = route.bindings?.find(
    (candidate) => candidate.profile === profile,
  );
  if (binding?.status !== "assigned" || binding.kind !== "resolver")
    throw new ResolverOutcomeExpectationError(
      `Resolver route ${route.role}:${route.catalogRoute} has no assigned binding for ${profile}`,
    );
  return binding;
};

const assertSourceDigest = (sourceDigest: string): void => {
  if (!/^[0-9a-f]{64}$/u.test(sourceDigest))
    throw new ResolverOutcomeExpectationError(
      "Resolver expected outcome requires a valid source digest",
    );
};

const assertStateDigest = (state: CampaignMatrixState): void => {
  const expected = sha256Hex(state.axes);
  if (state.pairwiseDigest !== expected)
    throw new ResolverOutcomeExpectationError(
      `Resolver expected outcome state digest is stale for ${state.stateId}`,
    );
};

export const resolverOutcomeExpectationFor = (
  input: Readonly<{
    readonly route: Extract<RouteDeclaration, { readonly kind: "resolver" }>;
    readonly state: CampaignMatrixState;
    readonly sourceDigest: string;
    /** Specialized route-local scenarios may override the state-derived outcome. */
    readonly outcome?: ResolverOutcomeKind | undefined;
  }>,
): ResolverOutcomeExpectation => {
  assertSourceDigest(input.sourceDigest);
  assertStateDigest(input.state);
  const binding = assignedResolverBindingFor(input.route, input.state.profile);
  const outcome = input.outcome ?? resolverOutcomeForState(input.state);
  if (!input.route.resolverOutcomes.includes(outcome))
    throw new ResolverOutcomeExpectationError(
      `Resolver route ${input.route.role}:${input.route.catalogRoute} does not declare expected outcome ${outcome}`,
    );
  if (!binding.resolverOutcomes.includes(outcome))
    throw new ResolverOutcomeExpectationError(
      `Resolver binding ${input.route.role}:${input.route.catalogRoute}:${input.state.profile} does not declare expected outcome ${outcome}`,
    );
  const identity = freezeResolverOutcomeIdentity({
    resolverKey: input.route.resolverKey,
    outcome,
    profile: input.state.profile,
    stateId: input.state.stateId,
    stateDigest: input.state.pairwiseDigest,
  });
  return {
    identity: bindResolverOutcomeSourceDigest(identity, input.sourceDigest),
    expectedTarget: resolverExpectedTargetFor(outcome),
    expectedUi: expectedUiFor(outcome),
  };
};

export const assertResolverOutcomeExpectation = (
  expected: ResolverOutcomeExpectation | undefined,
  actual: ResolverOutcomeExpectation | undefined,
): void => {
  if (expected === undefined) {
    if (actual !== undefined)
      throw new ResolverOutcomeExpectationError(
        "Unconditional route must not carry a resolver expected outcome",
      );
    return;
  }
  if (actual === undefined)
    throw new ResolverOutcomeExpectationError(
      `Missing resolver expected outcome for ${expected.identity.stateId}`,
    );
  if (stableSerialize(actual) !== stableSerialize(expected))
    throw new ResolverOutcomeExpectationError(
      `Resolver expected outcome is stale or mismatched for ${expected.identity.stateId}`,
    );
};

const resolverOutcomeNotApplicableFor = (
  profile: SeedProfile,
  outcome: Extract<ResolverOutcomeKind, "empty" | "query-error">,
): ResolverOutcomeNotApplicable => ({
  outcome,
  profile,
  constraintId: `resolver-${outcome}-preparation`,
  reason:
    outcome === EMPTY_OUTCOME
      ? "No deterministic state preparation currently removes every viewer-visible report from /reports/latest"
      : "No deterministic query-error fault currently exercises the /reports/latest resolver",
});

export const resolverOutcomeGapsFor = (
  route: Extract<RouteDeclaration, { readonly kind: "resolver" }>,
  states: readonly CampaignMatrixState[],
  specializedDeclarations: readonly Readonly<{
    readonly kind?: string;
    readonly declarationId?: string;
    readonly outcome?: ResolverOutcomeKind;
    readonly profile?: SeedProfile;
    readonly catalogRoute?: string;
    readonly role?: string;
  }>[] = [],
): readonly ResolverOutcomeNotApplicable[] => {
  const profiles = (route.bindings ?? []).flatMap((binding) =>
    binding.status === "assigned" ? [binding.profile] : [],
  );
  // The route contract requires the smallest assigned profile to be exercised.
  // Larger profiles inherit the same resolver behavior and do not multiply the
  // route-local specialized declarations into new global axes.
  const minimumProfile = profiles[0];
  return (minimumProfile === undefined ? [] : [minimumProfile]).flatMap(
    (profile) =>
      BLOCKED_OUTCOMES.flatMap((outcome) => {
        const declared = specializedDeclarations.some(
          (declaration) =>
            declaration.kind === "resolver" &&
            declaration.outcome === outcome &&
            declaration.profile === profile &&
            declaration.role === route.role &&
            declaration.catalogRoute === route.catalogRoute,
        );
        const stateCovered = states.some(
          (state) =>
            state.profile === profile &&
            state.axes.route === `${route.role}:${route.catalogRoute}` &&
            resolverOutcomeForState(state) === outcome,
        );
        return declared || stateCovered
          ? []
          : [resolverOutcomeNotApplicableFor(profile, outcome)];
      }),
  );
};

export const assertFrozenResolverOutcomes = (
  routes: CampaignManifest["routes"],
  cases: readonly MatrixExecutableCase[],
  sourceDigest: string,
  specializedDeclarations: readonly Readonly<{
    readonly declarationId?: string;
    readonly kind?: string;
    readonly outcome?: ResolverOutcomeKind;
  }>[] = [],
): void => {
  for (const matrixCase of cases)
    assertFrozenResolverCase(
      routes,
      matrixCase,
      sourceDigest,
      specializedDeclarations,
    );
};

const assertFrozenResolverCase = (
  routes: CampaignManifest["routes"],
  matrixCase: MatrixExecutableCase,
  sourceDigest: string,
  specializedDeclarations: readonly Readonly<{
    readonly declarationId?: string;
    readonly kind?: string;
    readonly outcome?: ResolverOutcomeKind;
  }>[],
): void => {
  const route = routes.find(
    (candidate) =>
      candidate.role === matrixCase.role &&
      candidate.catalogRoute === matrixCase.catalogRoute,
  );
  if (route === undefined)
    throw new ResolverOutcomeExpectationError(
      `Frozen matrix case has no route declaration: ${matrixCase.role}:${matrixCase.catalogRoute}`,
    );
  if (route.kind !== "resolver") {
    assertResolverOutcomeExpectation(undefined, matrixCase.expectedOutcome);
    return;
  }
  const declaration =
    matrixCase.declarationId === undefined
      ? undefined
      : specializedDeclarations.find(
          (candidate) =>
            candidate.declarationId === matrixCase.declarationId &&
            candidate.kind === "resolver",
        );
  if (matrixCase.declarationId !== undefined && declaration === undefined)
    throw new ResolverOutcomeExpectationError(
      `Frozen resolver case has no source declaration: ${matrixCase.declarationId}`,
    );
  const expected = resolverOutcomeExpectationFor({
    route,
    state: stateForMatrixCase(matrixCase),
    sourceDigest,
    ...(declaration?.outcome === undefined
      ? {}
      : { outcome: declaration.outcome }),
  });
  assertResolverOutcomeExpectation(expected, matrixCase.expectedOutcome);
};

const assertNever = (value: never): never => {
  throw new ResolverOutcomeExpectationError(
    `Unknown resolver outcome value: ${String(value)}`,
  );
};
