import type { MatrixPreflightControl } from "../../../../matrix/finalization/matrix-finalizer-preflight-contract.ts";
import { freezeDeep } from "../../../../source/manifest-source.ts";
import { candidatesForImmediateReveal } from "../../guards/preflight-reveal-registration.ts";
import type {
  RevealCandidate,
  RevealDiscoveryState,
} from "../../interaction/preflight-reveal-branches.ts";
import { revealCandidatesFor } from "../../interaction/preflight-reveal-discovery.ts";
import type { RevealRoute } from "../../interaction/preflight-reveal-types.ts";
import {
  PREFLIGHT_REVEAL_CANDIDATE_LIST,
  PREFLIGHT_REVEAL_CONTROL,
  PREFLIGHT_REVEAL_REDUCER_CHECKPOINT,
  type RevealExecutionGrant,
  type RevealReducerCheckpoint,
} from "../contracts/preflight-reveal-continuation-schemas.ts";
import {
  assetRefFor,
  rememberedRevealContinuationAsset,
} from "../preflight-reveal-continuation-assets.ts";
import { canonicalCandidatesForList } from "../preflight-reveal-continuation-candidates.ts";
import { controlsDigestFor } from "../preflight-reveal-continuation-checkpoint.ts";
import { registrationsForCheckpoint } from "../preflight-reveal-continuation-checkpoint-registration.ts";
import { RevealContinuationError } from "../preflight-reveal-continuation-errors.ts";
import { branchForRef } from "../receipts/preflight-reveal-continuation-receipts.ts";

const candidatesForCheckpoint = (input: {
  readonly checkpoint: RevealReducerCheckpoint;
  readonly branch: ReturnType<typeof branchForRef>;
  readonly route: RevealRoute;
}): readonly RevealCandidate[] => {
  const ref = input.checkpoint.currentCandidatesRef;
  const digest = input.checkpoint.currentCandidatesDigest;
  if ((ref === null) !== (digest === null))
    throw new RevealContinuationError(
      "R192 reducer checkpoint candidate root is incomplete",
    );
  if (ref === null || digest === null) return [];
  const candidateList = rememberedRevealContinuationAsset({
    artifact: PREFLIGHT_REVEAL_CANDIDATE_LIST,
    ref,
  });
  if (candidateList?.artifact !== PREFLIGHT_REVEAL_CANDIDATE_LIST)
    throw new RevealContinuationError(
      "R192 reducer checkpoint candidate root is unavailable",
    );
  return canonicalCandidatesForList({
    branch: input.branch,
    branchDigest: input.checkpoint.currentBranchRef ?? "",
    candidates: candidatesForImmediateReveal(
      {
        candidatesFor: (inventory) =>
          revealCandidatesFor(inventory, input.route),
      },
      input.branch,
    ),
    candidateList,
    candidateListDigest: digest,
  });
};

const checkpointForSnapshot = (
  snapshot: RevealExecutionGrant["reducerState"],
): RevealReducerCheckpoint => {
  const checkpoint = rememberedRevealContinuationAsset({
    artifact: PREFLIGHT_REVEAL_REDUCER_CHECKPOINT,
    ref: snapshot.checkpointRef,
  });
  if (checkpoint?.artifact !== PREFLIGHT_REVEAL_REDUCER_CHECKPOINT)
    throw new RevealContinuationError(
      "R192 reducer checkpoint root is unavailable",
    );
  if (assetRefFor(checkpoint) !== checkpoint.digest)
    throw new RevealContinuationError("R192 reducer checkpoint digest drifted");
  return checkpoint;
};

const controlsForCheckpoint = (
  checkpoint: RevealReducerCheckpoint,
): readonly MatrixPreflightControl[] => {
  if (checkpoint.controls.count !== checkpoint.controls.refs.length)
    throw new RevealContinuationError(
      "R192 reducer checkpoint control count drifted",
    );
  const controls = checkpoint.controls.refs.map((ref) => {
    const asset = rememberedRevealContinuationAsset({
      artifact: PREFLIGHT_REVEAL_CONTROL,
      ref,
    });
    if (asset?.artifact !== PREFLIGHT_REVEAL_CONTROL || asset.digest !== ref)
      throw new RevealContinuationError(
        "R192 reducer control leaf is unavailable",
      );
    return asset.control;
  });
  if (controlsDigestFor(controls) !== checkpoint.controls.digest)
    throw new RevealContinuationError(
      "R192 reducer control order or content drifted",
    );
  return controls;
};

const frontierForCheckpoint = (input: {
  readonly checkpoint: RevealReducerCheckpoint;
  readonly route: RevealRoute;
}) => {
  const currentBranch =
    input.checkpoint.currentBranchRef === null
      ? undefined
      : branchForRef(input.checkpoint.currentBranchRef);
  const currentCandidates =
    currentBranch === undefined
      ? undefined
      : candidatesForCheckpoint({
          checkpoint: input.checkpoint,
          branch: currentBranch,
          route: input.route,
        });
  if (
    (currentCandidates === undefined) !==
    (input.checkpoint.currentCandidatesRef === null)
  )
    throw new RevealContinuationError(
      "R192 reducer frontier root is incomplete",
    );
  return { currentBranch, currentCandidates };
};

export const reducerStateForCheckpoint = (input: {
  readonly snapshot: RevealExecutionGrant["reducerState"];
  readonly route: RevealRoute;
}): RevealDiscoveryState => {
  const checkpoint = checkpointForSnapshot(input.snapshot);
  const controls = controlsForCheckpoint(checkpoint);
  const discovered = new Map(
    registrationsForCheckpoint(controls, checkpoint.discovered),
  );
  const { currentBranch, currentCandidates } = frontierForCheckpoint({
    checkpoint,
    route: input.route,
  });
  return freezeDeep({
    queue: checkpoint.queueRefs.map(branchForRef),
    controls,
    discovered,
    visitedStatePaths: new Map(checkpoint.visitedStatePaths),
    actionCount: checkpoint.actionCount,
    branchCount: checkpoint.branchCount,
    ...(currentBranch === undefined ? {} : { currentBranch }),
    ...(currentCandidates === undefined ? {} : { currentCandidates }),
    ...(checkpoint.currentCandidateIndex === null
      ? {}
      : { currentCandidateIndex: checkpoint.currentCandidateIndex }),
  });
};
