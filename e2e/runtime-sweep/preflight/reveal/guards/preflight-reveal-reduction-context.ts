import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { createPreflightStateSelector } from "../../state/preflight-state-selector.ts";
import type { RevealRoute } from "../interaction/preflight-reveal-types.ts";

/**
 * Exact source and campaign identity used only to scope reveal diagnostics.
 * The diagnostic is advisory; it never grants reduction or replay authority.
 */
export type RevealReductionContext = Readonly<{
  readonly campaignId: string;
  readonly sourceSha: string;
  readonly sourceTree: string;
  readonly treeDigest: string;
  readonly sourceDigest: string;
  readonly planDigest: string;
  readonly selectorDigest: string;
  readonly stateId: string;
  readonly stateDigest: string;
  readonly role: string;
  readonly profile: string;
  readonly routeKey: string;
  readonly resolvedRoute: string;
}>;

/**
 * Builds the exact selector-bound context already used by preflight state
 * selection. Generic unit fixtures may omit it; an omitted context is always
 * an ordinary diagnostic result.
 */
export const revealReductionContextFor = (input: {
  readonly source: SourceArtifact;
  readonly state: CampaignMatrixState;
  readonly route: RevealRoute;
}): RevealReductionContext | undefined => {
  if (
    input.route.role === undefined ||
    input.route.catalogRoute === undefined ||
    input.route.resolvedRoute.length === 0
  )
    return undefined;
  const selector = createPreflightStateSelector({
    source: input.source,
    state: input.state,
  });
  if (
    selector.role !== input.route.role ||
    selector.catalogRoute !== input.route.catalogRoute ||
    selector.resolvedRoute !== input.route.resolvedRoute
  )
    return undefined;
  return {
    campaignId: input.source.campaignId,
    sourceSha: input.source.sourceSha,
    sourceTree: input.source.sourceTree,
    treeDigest: input.source.treeDigest,
    sourceDigest: input.source.sourceDigest,
    planDigest: input.source.plan.digest,
    selectorDigest: selector.selectorDigest,
    stateId: selector.stateId,
    stateDigest: selector.stateDigest,
    role: selector.role,
    profile: selector.profile,
    routeKey: `${selector.role}:${selector.catalogRoute}`,
    resolvedRoute: selector.resolvedRoute,
  };
};
