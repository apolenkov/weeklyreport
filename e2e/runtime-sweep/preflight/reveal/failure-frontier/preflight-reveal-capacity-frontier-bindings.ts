import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import type {
  RevealBootstrap,
  RevealParentPass,
} from "../continuation/contracts/preflight-reveal-continuation-schemas.ts";
import type { RevealReductionContext } from "../guards/preflight-reveal-reduction-context.ts";
import { revealReductionContextFor } from "../guards/preflight-reveal-reduction-context.ts";
import type {
  RevealBranch,
  RevealPureQueueInput,
} from "../interaction/preflight-reveal-branches.ts";
import type { RevealFailureFrontierPacket } from "./preflight-reveal-failure-frontier-io.ts";

const branchIdentityFor = (branch: RevealBranch): unknown => ({
  path: branch.path,
  surface: branch.surface,
  inventory: branch.inventory,
  url: branch.url,
});

type ContinuationRun = RevealParentPass["run"];

export const sameBranch = (left: RevealBranch, right: RevealBranch): boolean =>
  stableSerialize(branchIdentityFor(left)) ===
  stableSerialize(branchIdentityFor(right));

export const boundsFor = (
  input: RevealPureQueueInput,
  source: SourceArtifact,
) => ({
  maxDepth: input.maxDepth,
  maxRevealMaterialEdges: input.maxRevealMaterialEdges,
  maxRevealActions: input.maxRevealActions,
  maxControlsPerSegment: source.matrixLimits.maxControlsPerSegment,
});

export const boundsMatch = (
  actual: RevealBootstrap["bounds"],
  expected: ReturnType<typeof boundsFor>,
): boolean => stableSerialize(actual) === stableSerialize(expected);

export const sourceFieldsMatch = (
  source: SourceArtifact,
  context: RevealReductionContext,
  queueInput: RevealPureQueueInput,
  capacityPlanArtifactDigest: string,
  capacityPlanSelectorDigest: string,
  packet: RevealFailureFrontierPacket,
): boolean => {
  const manifest = packet.manifest;
  return (
    manifest.sourceSha === source.sourceSha &&
    manifest.sourceTree === source.sourceTree &&
    manifest.treeDigest === source.treeDigest &&
    manifest.sourceDigest === source.sourceDigest &&
    manifest.sourcePlanDigest === source.plan.digest &&
    manifest.capacityPlanArtifactDigest === capacityPlanArtifactDigest &&
    manifest.selectorDigest === capacityPlanSelectorDigest &&
    manifest.stateDigest === context.stateDigest &&
    manifest.routeDigest === sha256Hex(queueInput.route)
  );
};

export const contextForInput = (
  source: SourceArtifact,
  input: RevealPureQueueInput,
): RevealReductionContext | undefined => {
  const context = revealReductionContextFor({
    source,
    state: input.state,
    route: input.route,
  });
  if (
    context === undefined ||
    input.reductionContext === undefined ||
    stableSerialize(input.reductionContext) !== stableSerialize(context)
  )
    return undefined;
  return context;
};

export const runMatches = (input: {
  readonly run: ContinuationRun;
  readonly source: SourceArtifact;
  readonly context: RevealReductionContext;
  readonly queueInput: RevealPureQueueInput;
}): boolean => {
  const { run, source, context, queueInput } = input;
  return (
    run.campaignId === source.campaignId &&
    run.sourceSha === source.sourceSha &&
    run.sourceTree === source.sourceTree &&
    run.treeDigest === source.treeDigest &&
    run.sourceDigest === source.sourceDigest &&
    run.planDigest === source.plan.digest &&
    stableSerialize(run.state) === stableSerialize(queueInput.state) &&
    run.stateDigest === sha256Hex(run.state) &&
    run.selector.stateId === context.stateId &&
    run.selector.role === context.role &&
    run.selector.route === context.routeKey.slice(context.role.length + 1) &&
    run.selector.profile === context.profile &&
    run.selectorDigest === sha256Hex(run.selector) &&
    run.route.role === queueInput.route.role &&
    run.route.catalogRoute === queueInput.route.catalogRoute &&
    run.route.resolvedRoute === queueInput.route.resolvedRoute &&
    run.routeDigest === sha256Hex(run.route)
  );
};
