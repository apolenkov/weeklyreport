import { stableSerialize } from "../../../../support/ids.ts";
import { candidatesForImmediateReveal } from "../../guards/preflight-reveal-registration.ts";
import { revealCandidatesFor } from "../../interaction/preflight-reveal-discovery.ts";
import type { RevealRoute } from "../../interaction/preflight-reveal-types.ts";
import {
  PREFLIGHT_REVEAL_CANDIDATE_LIST,
  PREFLIGHT_REVEAL_REDUCER_CHECKPOINT,
  type RevealExecutionGrant,
} from "../contracts/preflight-reveal-continuation-schemas.ts";
import { rememberedRevealContinuationAsset } from "../preflight-reveal-continuation-assets.ts";
import { canonicalCandidatesForList } from "../preflight-reveal-continuation-candidates.ts";
import { branchForRef } from "../receipts/preflight-reveal-continuation-receipts.ts";

const checkpointFor = (grant: RevealExecutionGrant) => {
  const checkpoint = rememberedRevealContinuationAsset({
    artifact: PREFLIGHT_REVEAL_REDUCER_CHECKPOINT,
    ref: grant.reducerState.checkpointRef,
  });
  if (
    checkpoint?.artifact !== PREFLIGHT_REVEAL_REDUCER_CHECKPOINT ||
    checkpoint.digest !== grant.reducerState.checkpointRef ||
    checkpoint.digest !== grant.reducerStateDigest
  )
    throw new Error(
      "Reveal execution grant reducer checkpoint root is unavailable or drifted",
    );
  return checkpoint;
};

const assertCheckpointFrontier = (
  grant: RevealExecutionGrant,
  checkpoint: ReturnType<typeof checkpointFor>,
): void => {
  const frontier = grant.frontier;
  if (
    stableSerialize(checkpoint.queueRefs) !==
      stableSerialize(frontier.queueRefs) ||
    checkpoint.currentBranchRef !== frontier.branchRef ||
    checkpoint.currentCandidatesRef !== frontier.candidateListRef ||
    checkpoint.currentCandidatesDigest !== frontier.candidateListDigest ||
    checkpoint.currentCandidateIndex !== frontier.nextCandidateIndex ||
    checkpoint.actionCount !== frontier.actionCount ||
    checkpoint.branchCount !== frontier.branchCount
  )
    throw new Error(
      "Reveal execution grant frontier does not match its reducer checkpoint root",
    );
};

export const compactResumedFrontierFor = (input: {
  readonly grant: RevealExecutionGrant;
  readonly route: RevealRoute;
}) => {
  assertCheckpointFrontier(input.grant, checkpointFor(input.grant));
  const frontier = input.grant.frontier;
  const branch = branchForRef(frontier.branchRef);
  if (
    branch.path.digest !== frontier.pathDigest ||
    branch.surface.digest !== frontier.surfaceDigest ||
    branch.url !== frontier.url
  )
    throw new Error(
      "Reveal execution grant frontier assets are not bound to its branch",
    );
  const candidateList = rememberedRevealContinuationAsset({
    artifact: PREFLIGHT_REVEAL_CANDIDATE_LIST,
    ref: frontier.candidateListRef,
  });
  if (candidateList?.artifact !== PREFLIGHT_REVEAL_CANDIDATE_LIST)
    throw new Error(
      "Reveal execution grant frontier candidate list is unavailable",
    );
  const candidates = canonicalCandidatesForList({
    branch,
    branchDigest: frontier.branchDigest,
    candidates: candidatesForImmediateReveal(
      {
        candidatesFor: (inventory) =>
          revealCandidatesFor(inventory, input.route),
      },
      branch,
    ),
    candidateList,
    candidateListDigest: frontier.candidateListDigest,
  });
  if (
    candidates[frontier.nextCandidateIndex] === undefined ||
    candidateList.candidates[frontier.nextCandidateIndex]?.candidateId !==
      frontier.nextCandidateId
  )
    throw new Error(
      "Reveal execution grant frontier cursor is outside its candidate list",
    );
  return { branch, candidates };
};
