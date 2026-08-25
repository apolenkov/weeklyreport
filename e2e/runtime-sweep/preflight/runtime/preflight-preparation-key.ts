import type { CampaignMatrixState } from "../../matrix/campaign-matrix.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import { stableSerialize } from "../../support/ids.ts";
import { buildStatePreparationPlan } from "../../support/state-preparation.ts";
import type { PreflightRoute } from "../execution/playwright-preflight-support.ts";

export const statePreparationInputFor = (
  input: Readonly<{
    readonly state: CampaignMatrixState;
    readonly route: PreflightRoute;
    readonly repoRoot: string;
  }>,
) => ({
  profile: input.state.profile,
  axes: {
    lifecycle: input.state.axes.lifecycle,
    submission: input.state.axes.submission,
    ownership: input.state.axes.ownershipDensity,
    permission: input.state.axes.permission,
  },
  repoRoot: input.repoRoot,
  routeTarget: input.route.target,
  routeRole: input.route.role,
  routeKey: `${input.route.role}:${input.route.catalogRoute}`,
});

/**
 * Binds the prepared server baseline to the exact source, state, route, and
 * preparation inputs. Browser sessions are intentionally outside this key.
 */
export const preflightPreparationKeyFor = (
  input: Readonly<{
    readonly source: SourceArtifact;
    readonly state: CampaignMatrixState;
    readonly route: PreflightRoute;
    readonly databaseUrl: string;
    readonly repoRoot: string;
  }>,
): string => {
  const plan = buildStatePreparationPlan(
    statePreparationInputFor({
      state: input.state,
      route: input.route,
      repoRoot: input.repoRoot,
    }),
  );
  return stableSerialize({
    source: {
      sha: input.source.sourceSha,
      tree: input.source.sourceTree,
      treeDigest: input.source.treeDigest,
      digest: input.source.sourceDigest,
      planDigest: input.source.plan.digest,
    },
    state: {
      profile: input.state.profile,
      axes: input.state.axes,
    },
    route: {
      role: input.route.role,
      key: `${input.route.role}:${input.route.catalogRoute}`,
      catalogRoute: input.route.catalogRoute,
      resolvedRoute: input.route.resolvedRoute,
      target: input.route.target,
      ...(input.route.kind === undefined ? {} : { kind: input.route.kind }),
      ...(input.route.landingRoute === undefined
        ? {}
        : { landingRoute: input.route.landingRoute }),
      ...(input.route.expectedOutcome === undefined
        ? {}
        : { expectedOutcome: input.route.expectedOutcome }),
    },
    databaseUrl: input.databaseUrl,
    repoRoot: input.repoRoot,
    planDigest: plan.digest,
  });
};
