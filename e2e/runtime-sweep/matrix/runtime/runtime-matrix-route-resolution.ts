import type {
  ResolverOutcomeKind,
  Role,
  RouteBindingTarget,
} from "../../source/contracts.ts";
import type { ResolverOutcomeExpectation } from "../../support/resolver-outcome-expectations.ts";
import { resolverOutcomeExpectationFor } from "../../support/resolver-outcome-expectations.ts";
import type { CampaignMatrixState } from "../campaign-matrix.ts";
import type { RuntimeMatrixSource } from "./runtime-matrix-manifest.ts";

export type MatrixRouteResolutionError = (message: string) => Error;

export const routeForState = (
  source: RuntimeMatrixSource,
  state: CampaignMatrixState,
  resolverOutcome: ResolverOutcomeKind | undefined,
  fail: MatrixRouteResolutionError,
): Readonly<
  | {
      readonly kind?: "unconditional";
      readonly role: Role;
      readonly catalogRoute: string;
      readonly resolvedRoute: string;
      readonly landingRoute: string;
      readonly target: RouteBindingTarget;
      readonly expectedOutcome?: never;
    }
  | {
      readonly kind: "resolver";
      readonly role: Role;
      readonly catalogRoute: string;
      readonly resolvedRoute: string;
      readonly landingRoute?: never;
      readonly target: RouteBindingTarget;
      readonly expectedOutcome: ResolverOutcomeExpectation;
    }
> => {
  const routeKey = state.axes.route;
  const route = source.routes.find(
    (candidate) => `${candidate.role}:${candidate.catalogRoute}` === routeKey,
  );
  if (!route?.bindings) throw fail(`Matrix route is not bound: ${routeKey}`);
  const assignment = route.bindings.find(
    (binding) => binding.profile === state.profile,
  );
  if (assignment?.status !== "assigned")
    throw fail(`Matrix route is not assigned: ${routeKey}`);
  if (route.kind === "resolver")
    return {
      kind: "resolver",
      role: route.role,
      catalogRoute: route.catalogRoute,
      resolvedRoute: assignment.resolvedRoute,
      target: assignment.target,
      expectedOutcome: resolverOutcomeExpectationFor({
        route,
        state,
        sourceDigest: source.sourceDigest,
        ...(resolverOutcome === undefined ? {} : { outcome: resolverOutcome }),
      }),
    };
  if (assignment.kind !== "unconditional")
    throw fail(
      `Matrix route binding lost unconditional discriminator: ${routeKey}`,
    );
  const landingRoute =
    state.axes.permission === "anonymous"
      ? `/?${new URLSearchParams({ next: assignment.resolvedRoute }).toString()}`
      : assignment.landingRoute;
  return {
    ...(route.kind === undefined ? {} : { kind: "unconditional" as const }),
    role: route.role,
    catalogRoute: route.catalogRoute,
    resolvedRoute: assignment.resolvedRoute,
    landingRoute,
    target: assignment.target,
  };
};
