import type { Page } from "@playwright/test";

import type { SourceArtifact } from "../../source/source-artifact.ts";
import { stableSerialize } from "../../support/ids.ts";
import {
  assertCapacitySurveyPlanMatchesSource,
  CapacitySurveyContractError,
  type CapacitySurveyPlan,
  type CapacitySurveyResult,
  createCapacitySurveyResult,
} from "../capacity/preflight-capacity-survey-contract.ts";
import {
  assertInitialLanding,
  assertResolverOutcomeUi,
} from "../reveal/guards/preflight-reveal-guards.ts";
import { discoverRevealControlsWithSummary } from "../reveal/interaction/preflight-reveal-discovery.ts";
import type { RevealDiscoveryProgress } from "../reveal/interaction/preflight-reveal-types.ts";
import type { PreflightRuntimePreparationWithBoundary } from "../runtime/preflight-runtime-setup.ts";
import {
  playwrightHarnessFor,
  preflightControlForPlan,
  revealHarnessFor,
} from "./playwright-preflight.ts";
import {
  revealRouteFor,
  routeForState,
} from "./playwright-preflight-support.ts";

const exactSurveyTarget = (
  source: SourceArtifact,
  plan: CapacitySurveyPlan,
): Readonly<{
  state: SourceArtifact["plan"]["states"][number];
  route: ReturnType<typeof routeForState>;
}> => {
  assertCapacitySurveyPlanMatchesSource(plan, {
    sourceSha: source.sourceSha,
    sourceTree: source.sourceTree,
    treeDigest: source.treeDigest,
    sourceDigest: source.sourceDigest,
    planDigest: source.plan.digest,
  });
  const state = source.plan.states.find(
    (candidate) => candidate.stateId === plan.selector.stateId,
  );
  if (state === undefined)
    throw new CapacitySurveyContractError(
      `Capacity survey state is absent from SOURCE: ${plan.selector.stateId}`,
    );
  const route = routeForState(source, state);
  if (
    stableSerialize(state) !== stableSerialize(plan.state) ||
    stableSerialize(route) !== stableSerialize(plan.route)
  )
    throw new CapacitySurveyContractError(
      "Capacity survey state or route drifted from its exact plan",
    );
  return { state, route };
};

export async function runPlaywrightPreflightCapacitySurvey(input: {
  readonly source: SourceArtifact;
  readonly plan: CapacitySurveyPlan;
  readonly page: Page;
  readonly expectedOrigin: string;
  readonly prepare: PreflightRuntimePreparationWithBoundary;
  readonly beforeComplete: () => Promise<void>;
  readonly onProgress?: (progress: RevealDiscoveryProgress) => void;
  readonly now?: () => number;
}): Promise<CapacitySurveyResult> {
  const target = exactSurveyTarget(input.source, input.plan);
  const now = input.now ?? Date.now;
  const startedMs = now();
  const harness = playwrightHarnessFor({
    source: input.source,
    page: input.page,
    expectedOrigin: input.expectedOrigin,
    prepare: input.prepare,
  });
  await harness.prepare(target.state, target.route, true);
  await harness.navigate(target.route.resolvedRoute);
  assertInitialLanding(
    target.route,
    harness.currentUrl(),
    input.expectedOrigin,
  );
  const initialInventory = await harness.inventory();
  if (target.route.expectedOutcome !== undefined)
    assertResolverOutcomeUi(target.route.expectedOutcome, initialInventory);
  const summary = (
    await discoverRevealControlsWithSummary({
      state: target.state,
      route: revealRouteFor(target.route),
      initialInventory,
      harness: revealHarnessFor(harness),
      controlFor: preflightControlForPlan,
      maxDepth: input.plan.limits.maxDepth,
      maxRevealMaterialEdges: input.plan.limits.materialEdges,
      maxRevealActions: input.plan.limits.actions,
      maxControlsPerSegment: input.plan.limits.controls,
      ...(input.onProgress === undefined
        ? {}
        : { onProgress: input.onProgress }),
    })
  ).summary;
  await input.beforeComplete();
  const completedMs = now();
  return createCapacitySurveyResult({
    plan: input.plan,
    terminal: summary,
    startedAt: new Date(startedMs).toISOString(),
    completedAt: new Date(completedMs).toISOString(),
    durationMs: completedMs - startedMs,
  });
}
