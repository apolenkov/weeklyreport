import type { Page } from "@playwright/test";

import type { CampaignMatrixState } from "../matrix/campaign-matrix.ts";
import type {
  MatrixPreflightControl,
  MatrixPreflightEntry,
  MatrixPreflightSegment,
} from "../matrix/matrix-finalizer-contract.ts";
import {
  assertSpecializedDeclarations,
  SPECIALIZED_DECLARATIONS,
  type SpecializedDeclaration,
} from "../matrix/specialized-declarations.ts";
import { type DomInventory, inventoryDom } from "../replay/dom-inventory.ts";
import {
  type LiveControlPlan,
  planLiveControlActions,
} from "../replay/live-control-planning.ts";
import { navigate } from "../replay/navigation.ts";
import type {
  Action,
  MatrixExecution,
  RouteBindingTarget,
} from "../source/contracts.ts";
import type { SourceArtifact } from "../source/source-artifact.ts";
import { sha256Hex, stableId } from "../support/ids.ts";
import {
  createPreflightArtifact,
  type PreflightArtifact,
} from "./preflight-artifact.ts";
import { preflightSessionGroupKey } from "./preflight-session.ts";

export type PreflightRoute = Readonly<{
  readonly role: CampaignMatrixState["axes"]["role"];
  readonly catalogRoute: string;
  readonly resolvedRoute: string;
  readonly target: RouteBindingTarget;
}>;

export interface BrowserPreflightHarness {
  readonly prepare: (
    state: CampaignMatrixState,
    route: PreflightRoute,
  ) => Promise<void>;
  readonly navigate: (route: string) => Promise<void>;
  readonly inventory: () => Promise<DomInventory>;
}

export class BrowserPreflightError extends Error {
  override readonly name = "BrowserPreflightError";
}

const routeForState = (
  source: SourceArtifact,
  state: CampaignMatrixState,
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
  return {
    role: route.role,
    catalogRoute,
    resolvedRoute: binding.resolvedRoute,
    target: binding.target,
  };
};

export const preflightControlForPlan = (
  plan: LiveControlPlan,
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
    };
  if (plan.policy === undefined || plan.reason === undefined)
    throw new BrowserPreflightError(
      `Control ${plan.control.controlKey} has no action or inapplicable reason`,
    );
  return {
    controlKey: plan.control.controlKey,
    inventory,
    inapplicable: {
      constraintId: `preflight-${plan.policy}`,
      reason: plan.reason,
    },
  };
};

const controlsFor = (
  inventory: DomInventory,
): readonly MatrixPreflightControl[] =>
  planLiveControlActions(inventory.controls, { formSafety: "disposable-reset" })
    .map(preflightControlForPlan)
    .toSorted((left, right) => left.controlKey.localeCompare(right.controlKey));

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
  if (declaration.executionKind === "infrastructure")
    return {
      kind: "infrastructure",
      faultId: declaration.faultId,
      observation: {
        observationId: declaration.declarationId,
        kind: declaration.observationKind,
      },
    };
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
      : declaration.transition;
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
    state,
    execution: specializedExecution(declaration),
  };
};

const declarationsForSource = (
  source: SourceArtifact,
): readonly SpecializedDeclaration[] => {
  assertSpecializedDeclarations(source.specializedDeclarations);
  return source.specializedDeclarations.map((declaration) => {
    const known = SPECIALIZED_DECLARATIONS.find(
      ({ declarationId }) => declarationId === declaration.declarationId,
    );
    if (known === undefined)
      throw new BrowserPreflightError(
        `Unknown specialized declaration ${declaration.declarationId}`,
      );
    return declaration;
  });
};

const attachSpecializedDeclarations = (
  source: SourceArtifact,
  segments: readonly MatrixPreflightSegment[],
): readonly MatrixPreflightSegment[] => {
  const declarations = declarationsForSource(source);
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

export function assertSpecializedNominalTargets(source: SourceArtifact): void {
  declarationsForSource(source).forEach((declaration) => {
    nominalStateFor(source, declaration);
  });
}

export async function runBrowserPreflight(input: {
  readonly source: SourceArtifact;
  readonly harness: BrowserPreflightHarness;
}): Promise<PreflightArtifact> {
  assertSpecializedDeclarations(input.source.specializedDeclarations);
  assertSpecializedNominalTargets(input.source);
  const entries = input.source.plan.states
    .map((state) => ({ state, route: routeForState(input.source, state) }))
    .toSorted((left, right) => {
      const bySession = preflightSessionGroupKey(
        left.state,
        left.route,
      ).localeCompare(preflightSessionGroupKey(right.state, right.route));
      const byRoute = left.route.resolvedRoute.localeCompare(
        right.route.resolvedRoute,
      );
      return (
        bySession ||
        byRoute ||
        left.state.stateId.localeCompare(right.state.stateId)
      );
    });
  const segments = await entries.reduce<
    Promise<readonly MatrixPreflightSegment[]>
  >(async (promise, { state, route }) => {
    const prior = await promise;
    await input.harness.prepare(state, route);
    await input.harness.navigate(route.resolvedRoute);
    const inventory = await input.harness.inventory();
    return [
      ...prior,
      { state, controls: controlsFor(inventory), specialized: [] },
    ];
  }, Promise.resolve([]));
  return createPreflightArtifact({
    source: input.source,
    segments: attachSpecializedDeclarations(input.source, segments),
  });
}

export function runPlaywrightPreflight(input: {
  readonly source: SourceArtifact;
  readonly page: Page;
  readonly prepare: BrowserPreflightHarness["prepare"];
}): Promise<PreflightArtifact> {
  return runBrowserPreflight({
    source: input.source,
    harness: {
      prepare: input.prepare,
      navigate: async (route) => {
        await navigate(input.page, route);
      },
      inventory: () => inventoryDom(input.page),
    },
  });
}
