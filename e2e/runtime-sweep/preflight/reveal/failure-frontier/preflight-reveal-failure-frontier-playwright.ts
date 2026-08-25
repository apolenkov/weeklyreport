import type { CapacitySurveyPlan } from "../../capacity/preflight-capacity-survey-contract.ts";
import {
  type BrowserPreflightHarness,
  revealHarnessFor,
} from "../../execution/playwright-preflight.ts";
import {
  type PreflightRoute,
  revealRouteFor,
} from "../../execution/playwright-preflight-support.ts";
import { revealCandidatesFor } from "../interaction/preflight-reveal-discovery.ts";
import type { RevealFailureFrontierPacket } from "./preflight-reveal-failure-frontier-io.ts";
import {
  replayRevealFailureFrontierBoundary,
  type RevealFailureFrontierReplayClassification,
} from "./preflight-reveal-failure-frontier-replay.ts";

const preflightRouteForPlan = (plan: CapacitySurveyPlan): PreflightRoute =>
  plan.route.kind === "resolver"
    ? {
        kind: "resolver",
        role: plan.route.role,
        catalogRoute: plan.route.catalogRoute,
        resolvedRoute: plan.route.resolvedRoute,
        target: plan.route.target,
        expectedOutcome: plan.route.expectedOutcome,
      }
    : {
        ...(plan.route.kind === undefined ? {} : { kind: "unconditional" }),
        role: plan.route.role,
        catalogRoute: plan.route.catalogRoute,
        resolvedRoute: plan.route.resolvedRoute,
        landingRoute: plan.route.landingRoute,
        target: plan.route.target,
      };

export const replayFailureFrontierWithBrowserHarness = async (input: {
  readonly plan: CapacitySurveyPlan;
  readonly packet: RevealFailureFrontierPacket;
  readonly harness: BrowserPreflightHarness;
}): Promise<RevealFailureFrontierReplayClassification> => {
  const preflightRoute = preflightRouteForPlan(input.plan);
  const route = revealRouteFor(preflightRoute);
  await input.harness.prepare(input.plan.state, preflightRoute, true);
  return replayRevealFailureFrontierBoundary({
    packet: input.packet,
    harness: revealHarnessFor(input.harness),
    state: input.plan.state,
    route,
    initialSurface:
      input.packet.branch.path.steps[0]?.before ?? input.packet.branch.surface,
    candidatesFor: (inventory) => revealCandidatesFor(inventory, route),
  });
};
