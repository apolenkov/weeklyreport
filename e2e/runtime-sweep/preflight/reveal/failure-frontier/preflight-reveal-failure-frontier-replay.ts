import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import { candidateListDigestFor } from "../continuation/receipts/preflight-reveal-continuation-receipt-assets.ts";
import { candidateListAssetFor } from "../continuation/receipts/preflight-reveal-continuation-receipt-assets.ts";
import { candidatesForImmediateReveal } from "../guards/preflight-reveal-registration.ts";
import { liveRevealActionBoundary } from "../interaction/preflight-reveal-action-boundary.ts";
import { restoreRevealBranch } from "../interaction/preflight-reveal-branch-execution.ts";
import type { RevealCandidate } from "../interaction/preflight-reveal-branches.ts";
import { freezeRevealCandidateInputsForHarness } from "../interaction/preflight-reveal-queue.ts";
import {
  RevealDiscoveryError,
  type RevealExecutionHarness,
  type RevealRoute,
} from "../interaction/preflight-reveal-types.ts";
import type { RevealFailureFrontierPacket } from "./preflight-reveal-failure-frontier-io.ts";

export type RevealFailureFrontierReplayClassification =
  "PATH_OR_LINEAGE_DRIFT" | "REPRODUCED" | "NOT_REPRODUCED";

const restoreForReplay = async (input: {
  readonly packet: RevealFailureFrontierPacket;
  readonly harness: RevealExecutionHarness;
  readonly state: CampaignMatrixState;
  readonly route: RevealRoute;
  readonly initialSurface: RevealFailureFrontierPacket["branch"]["surface"];
}): Promise<RevealFailureFrontierPacket["branch"] | undefined> => {
  try {
    return await restoreRevealBranch({
      harness: input.harness,
      state: input.state,
      route: input.route,
      initialSurface: input.initialSurface,
      branch: input.packet.branch,
    });
  } catch (error: unknown) {
    if (error instanceof RevealDiscoveryError) return undefined;
    throw error;
  }
};

const canonicalCandidateMatches = (input: {
  readonly packet: RevealFailureFrontierPacket;
  readonly branch: RevealFailureFrontierPacket["branch"];
  readonly candidates: readonly RevealCandidate[];
}): boolean => {
  const list = candidateListAssetFor(
    input.branch,
    input.candidates,
    input.packet.manifest.branchDigest,
  );
  const candidate = list.candidates[input.packet.manifest.candidateIndex];
  return (
    list.digest === input.packet.manifest.candidateListRef &&
    candidateListDigestFor(
      list.candidates.map(({ candidateId }) => candidateId),
    ) === input.packet.manifest.candidateListDigest &&
    candidate?.candidateId === input.packet.manifest.candidateIdentity &&
    stableSerialize(candidate.representativeInput) ===
      stableSerialize(input.packet.manifest.representativeInput) &&
    sha256Hex(candidate.action.controlKey) ===
      input.packet.manifest.actionKeyDigest
  );
};

export const replayRevealFailureFrontierBoundary = async (input: {
  readonly packet: RevealFailureFrontierPacket;
  readonly harness: RevealExecutionHarness;
  readonly state: CampaignMatrixState;
  readonly route: RevealRoute;
  readonly initialSurface: RevealFailureFrontierPacket["branch"]["surface"];
  readonly candidatesFor: (
    inventory: RevealFailureFrontierPacket["branch"]["inventory"],
  ) => readonly RevealCandidate[];
}): Promise<RevealFailureFrontierReplayClassification> => {
  const restored = await restoreForReplay(input);
  if (restored === undefined) return "PATH_OR_LINEAGE_DRIFT";
  const candidates = await freezeRevealCandidateInputsForHarness(
    input.harness,
    candidatesForImmediateReveal(
      { candidatesFor: input.candidatesFor },
      restored,
    ),
  );
  if (
    !canonicalCandidateMatches({
      packet: input.packet,
      branch: restored,
      candidates,
    })
  )
    return "PATH_OR_LINEAGE_DRIFT";
  const candidate = candidates[input.packet.manifest.candidateIndex];
  if (candidate === undefined) return "PATH_OR_LINEAGE_DRIFT";
  try {
    await liveRevealActionBoundary(input.harness, restored, candidate.action);
  } catch (error: unknown) {
    if (error instanceof RevealDiscoveryError) return "REPRODUCED";
    throw error;
  }
  return "NOT_REPRODUCED";
};
