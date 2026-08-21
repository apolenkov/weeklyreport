import { mkdtemp, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import type { SourceArtifact } from "../../../manifest/manifest.ts";
import {
  CAPACITY_SURVEY_MAX_ARTIFACT_BYTES,
  type CapacitySurveyPlan,
  createCapacitySurveyPlan,
  createCapacitySurveySelector,
} from "../../capacity/preflight-capacity-survey-contract.ts";
import {
  revealRouteFor,
  routeForState,
} from "../../execution/playwright-preflight-support.ts";
import { preflightJournalStateDigest } from "../../journal/preflight-journal-contract.ts";
import { type RevealReducerInput } from "../continuation/preflight-reveal-continuation-reducer.ts";
import type {
  RevealBranch,
  RevealDiscoveryState,
} from "../interaction/preflight-reveal-branches.ts";
import { revealCandidateIdentityFor } from "../interaction/preflight-reveal-candidate-identity.ts";
import { revealCandidatesFor } from "../interaction/preflight-reveal-discovery.ts";
import {
  captureRevealFailureFrontier,
  readRevealFailureFrontierPacket,
  type RevealFailureFrontierPacket,
} from "./preflight-reveal-failure-frontier-io.ts";
export const routeStateFor = (source: SourceArtifact) => {
  const state = source.plan.states.find(
    (candidate) =>
      candidate.axes.route === "admin:/admin" && candidate.profile === "demo",
  );
  if (state === undefined) throw new Error("Fixture admin state is missing");
  return { state, route: revealRouteFor(routeForState(source, state)) };
};

export const capacityPlanFor = (input: {
  readonly source: SourceArtifact;
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly route: ReturnType<typeof revealRouteFor>;
  readonly queueInput: RevealReducerInput;
}): CapacitySurveyPlan => {
  const state = {
    stateId: input.state.stateId,
    pairwiseDigest: input.state.pairwiseDigest,
    profile: input.state.profile,
    axes: input.state.axes,
  } as const;
  const selector = createCapacitySurveySelector({
    stateId: state.stateId,
    stateDigest: preflightJournalStateDigest({
      state,
      role: input.route.role,
      catalogRoute: input.route.catalogRoute,
      resolvedRoute: input.route.resolvedRoute,
    }),
    pairwiseDigest: state.pairwiseDigest,
    profile: state.profile,
    axes: state.axes,
    role: input.route.role,
    catalogRoute: input.route.catalogRoute,
    resolvedRoute: input.route.resolvedRoute,
  });
  return createCapacitySurveyPlan({
    artifact: "PREFLIGHT_CAPACITY_SURVEY_PLAN",
    version: 1,
    authority: "diagnostic-only",
    campaignId: input.source.campaignId,
    surveyId: "capacity-frontier-fixture",
    sourceSha: input.source.sourceSha,
    sourceTree: input.source.sourceTree,
    treeDigest: input.source.treeDigest,
    sourceDigest: input.source.sourceDigest,
    planDigest: input.source.plan.digest,
    selector,
    state,
    route: input.route,
    viewport: input.source.viewport,
    limits: {
      maxDepth: input.queueInput.maxDepth,
      materialEdges: input.queueInput.maxRevealMaterialEdges,
      actions: input.queueInput.maxRevealActions,
      controls: input.queueInput.maxControlsPerSegment,
      maxDurationMs: 60_000,
      maxChildren: 1,
      maxPerFileBytes: CAPACITY_SURVEY_MAX_ARTIFACT_BYTES,
      maxAggregateArchiveBytes: CAPACITY_SURVEY_MAX_ARTIFACT_BYTES * 2,
    },
  });
};

export const packetFor = async (input: {
  readonly source: SourceArtifact;
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly route: ReturnType<typeof revealRouteFor>;
  readonly queueInput: RevealReducerInput;
  readonly discoveryState: RevealDiscoveryState;
  readonly branch: RevealBranch;
  readonly pendingBranch: RevealBranch;
  readonly candidates: ReturnType<typeof revealCandidatesFor>;
}): Promise<{
  readonly packet: RevealFailureFrontierPacket;
  readonly packetRoot: string;
  readonly plan: CapacitySurveyPlan;
}> => {
  const packetRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), "capacity-frontier-adapter-")),
  );
  const plan = capacityPlanFor(input);
  const candidate = input.candidates[0];
  if (candidate === undefined) throw new Error("Fixture candidate is missing");
  await captureRevealFailureFrontier({
    packetRoot,
    plan,
    failure: {
      state: input.discoveryState,
      branch: input.branch,
      pendingBranch: input.pendingBranch,
      candidates: input.candidates,
      candidateIndex: 0,
      candidateIdentity: revealCandidateIdentityFor({
        branch: input.branch,
        candidate,
      }),
      originalError: new Error("frontier candidate failed"),
    },
  });
  return {
    packet: await readRevealFailureFrontierPacket({
      packetRoot,
      expectedPlan: plan,
    }),
    packetRoot,
    plan,
  };
};
