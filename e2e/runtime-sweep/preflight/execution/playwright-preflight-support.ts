import type { CampaignMatrixState } from "../../matrix/campaign-matrix.ts";
import type {
  MatrixPreflightControl,
  MatrixPreflightEntry,
  MatrixPreflightSegment,
} from "../../matrix/finalization/matrix-finalizer-contract.ts";
import type { RevealTransition } from "../../matrix/reveal-transition.ts";
import type { SpecializedDeclaration } from "../../matrix/specialized/specialized-declarations.ts";
import type { LiveControlPlan } from "../../replay/live-control/live-control-planning.ts";
import type {
  Action,
  MatrixExecution,
  ResolverOutcomeKind,
  RouteBindingTarget,
} from "../../source/contracts.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import { sha256Hex, stableId } from "../../support/ids.ts";
import {
  type ResolverOutcomeExpectation,
  resolverOutcomeExpectationFor,
} from "../../support/resolver-outcome-expectations.ts";
import { declarationsForSource } from "./playwright-preflight-specialized.ts";
export { assertSpecializedNominalTargets } from "./playwright-preflight-specialized.ts";
import type {
  RevealExecutionHarness,
  RevealPreparation,
} from "../reveal/interaction/preflight-reveal-types.ts";
import type { RevealPath, RevealSurface } from "../reveal-path.ts";

export type PreflightRoute = Readonly<
  | {
      readonly kind?: "unconditional";
      readonly role: CampaignMatrixState["axes"]["role"];
      readonly catalogRoute: string;
      readonly resolvedRoute: string;
      readonly landingRoute: string;
      readonly target: RouteBindingTarget;
      readonly expectedOutcome?: never;
    }
  | {
      readonly kind: "resolver";
      readonly role: CampaignMatrixState["axes"]["role"];
      readonly catalogRoute: string;
      readonly resolvedRoute: string;
      readonly landingRoute?: never;
      readonly target: RouteBindingTarget;
      readonly expectedOutcome: ResolverOutcomeExpectation;
    }
>;

export interface BrowserPreflightHarness extends Omit<
  RevealExecutionHarness,
  "prepare" | "currentUrl" | "executeReveal"
> {
  readonly expectedOrigin: string;
  readonly prepare: (
    state: CampaignMatrixState,
    route: PreflightRoute,
    resetRequired: boolean,
  ) => Promise<RevealPreparation | void>;
  readonly currentUrl: () => string;
  readonly executeReveal?: RevealExecutionHarness["executeReveal"];
}

export class BrowserPreflightError extends Error {
  override readonly name = "BrowserPreflightError";
}

const anonymousLandingRouteFor = (resolvedRoute: string): string => {
  const query = new URLSearchParams({ next: resolvedRoute });
  return `/?${query.toString()}`;
};

export const routeForState = (
  source: SourceArtifact,
  state: CampaignMatrixState,
  resolverOutcome?: ResolverOutcomeKind,
): PreflightRoute => {
  const separator = state.axes.route.indexOf(":");
  const catalogRoute =
    separator === -1 ? state.axes.route : state.axes.route.slice(separator + 1);
  const route = source.routes.find(
    (candidate) =>
      `${candidate.role}:${candidate.catalogRoute}` === state.axes.route,
  );
  const binding = route?.bindings?.find(
    (candidate) =>
      candidate.profile === state.profile && candidate.status === "assigned",
  );
  if (route === undefined || binding === undefined)
    throw new BrowserPreflightError(
      `Preflight state is not assigned to a route: ${state.stateId}`,
    );
  if (route.kind === "resolver")
    return {
      kind: "resolver",
      role: route.role,
      catalogRoute,
      resolvedRoute: binding.resolvedRoute,
      target: binding.target,
      expectedOutcome: resolverOutcomeExpectationFor({
        route,
        state,
        sourceDigest: source.sourceDigest,
        ...(resolverOutcome === undefined ? {} : { outcome: resolverOutcome }),
      }),
    };
  if (binding.kind !== "unconditional")
    throw new BrowserPreflightError(
      `Preflight route binding lost unconditional discriminator: ${state.stateId}`,
    );
  const landingRoute =
    state.axes.permission === "anonymous"
      ? anonymousLandingRouteFor(binding.resolvedRoute)
      : binding.landingRoute;
  return {
    ...(route.kind === undefined ? {} : { kind: "unconditional" as const }),
    role: route.role,
    catalogRoute,
    resolvedRoute: binding.resolvedRoute,
    landingRoute,
    target: binding.target,
  };
};

/**
 * Keep entry navigation separate from the URL boundary used by reveal logic.
 * The returned route is intentionally shape-compatible with RevealRoute, so
 * existing reveal preparation can reuse the exact landing pathname and query.
 */
export const revealRouteFor = (route: PreflightRoute): PreflightRoute => ({
  ...route,
  ...(route.expectedOutcome === undefined
    ? { resolvedRoute: route.landingRoute }
    : { resolvedRoute: route.expectedOutcome.expectedTarget }),
});

export const preflightControlForPlan = (
  plan: LiveControlPlan,
  revealPath: RevealPath,
  expectedSurface: RevealSurface,
  expectedActionTransition: RevealTransition | null = null,
  expectedActionSurface: RevealSurface | null = null,
): MatrixPreflightControl => {
  const inventory = {
    ariaRole: plan.control.role,
    accessibleName: plan.control.accessibleName,
    enabled: plan.control.enabled,
    order: plan.control.order,
    domOrderKey: plan.control.domOrderKey,
    href: plan.control.href,
  } as const;
  if (plan.action !== undefined)
    return {
      controlKey: plan.control.controlKey,
      inventory,
      action: plan.action,
      revealPath,
      expectedSurface,
      expectedActionTransition,
      expectedActionSurface,
    };
  if (plan.policy === undefined || plan.reason === undefined)
    throw new BrowserPreflightError(
      `Control ${plan.control.controlKey} has no action or inapplicable reason`,
    );
  return {
    controlKey: plan.control.controlKey,
    inventory,
    revealPath,
    expectedSurface,
    expectedActionTransition,
    expectedActionSurface,
    inapplicable: {
      constraintId: `preflight-${plan.policy}`,
      reason: plan.reason,
    },
  };
};

const nominalStateFor = (
  source: SourceArtifact,
  declaration: SpecializedDeclaration,
): CampaignMatrixState => {
  const routeKey = `${declaration.role}:${declaration.catalogRoute}`;
  const state = source.plan.states.find(
    (candidate) =>
      candidate.profile === declaration.profile &&
      candidate.axes.route === routeKey &&
      candidate.axes.lifecycle === "open" &&
      candidate.axes.submission === "draft" &&
      candidate.axes.ownershipDensity === "single" &&
      candidate.axes.permission === "allowed",
  );
  if (state === undefined)
    throw new BrowserPreflightError(
      `Specialized declaration ${declaration.declarationId} has no nominal target state`,
    );
  return state;
};

const specializedExecution = (
  declaration: SpecializedDeclaration,
): MatrixExecution => {
  if (declaration.kind === "resolver") {
    const action = {
      controlKey: `declaration:${declaration.declarationId}`,
      operation: "navigate",
      safety: "read-only",
      transition: "none",
    } as const;
    return declaration.executionKind === "navigation"
      ? { kind: "navigation", action }
      : {
          kind: "fault",
          faultId:
            declaration.faultId ??
            (() => {
              throw new BrowserPreflightError(
                `Resolver fault declaration ${declaration.declarationId} has no fault id`,
              );
            })(),
          action,
        };
  }
  if (declaration.executionKind === "infrastructure")
    return {
      kind: "infrastructure",
      faultId: declaration.faultId,
      observation: {
        observationId: declaration.declarationId,
        kind: declaration.observationKind,
      },
    };
  if (
    declaration.kind !== "http-fault" &&
    declaration.kind !== "stale-concurrency"
  )
    throw new BrowserPreflightError(
      "Specialized declaration has no action contract",
    );
  const action: Action = {
    controlKey: `declaration:${declaration.declarationId}`,
    operation: declaration.operation,
    safety: declaration.safety,
    transition: declaration.transition,
  };
  switch (declaration.executionKind) {
    case "fault":
      return { kind: "fault", faultId: declaration.faultId, action };
    case "concurrency":
      return { kind: "concurrency", faultId: declaration.faultId, action };
    default:
      throw new BrowserPreflightError("Unknown specialized execution kind");
  }
};

const specializedEntryFor = (
  source: SourceArtifact,
  declaration: SpecializedDeclaration,
): MatrixPreflightEntry => {
  const base = nominalStateFor(source, declaration);
  const controlTransition =
    declaration.executionKind === "infrastructure"
      ? "none"
      : "transition" in declaration
        ? declaration.transition
        : "none";
  const axes = {
    ...base.axes,
    fault: declaration.faultMode,
    controlTransition,
  };
  const state = {
    ...base,
    axes,
    stateId: stableId("matrix-specialized-state", {
      base: base.stateId,
      declarationId: declaration.declarationId,
    }),
    pairwiseDigest: sha256Hex(axes),
  };
  return {
    declarationId: declaration.declarationId,
    ...(declaration.kind === "resolver"
      ? {
          resolverOutcome: declaration.outcome,
          resolverRecoveryOutcome: declaration.recoveryOutcome,
        }
      : {}),
    state,
    execution: specializedExecution(declaration),
  };
};

export const attachSpecializedDeclarations = (
  source: SourceArtifact,
  segments: readonly MatrixPreflightSegment[],
): readonly MatrixPreflightSegment[] => {
  const declarations = declarationsForSource(
    source,
    (message) => new BrowserPreflightError(message),
  );
  const entries = declarations.map((declaration) => ({
    baseStateId: nominalStateFor(source, declaration).stateId,
    entry: specializedEntryFor(source, declaration),
  }));
  return segments.map((segment) => ({
    ...segment,
    specialized: entries
      .filter(({ baseStateId }) => baseStateId === segment.state.stateId)
      .map(({ entry }) => entry),
  }));
};
