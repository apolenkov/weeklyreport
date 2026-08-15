import type { MatrixPreflightControl } from "../../../matrix/finalization/matrix-finalizer-preflight-contract.ts";
import { freezeDeep } from "../../../source/manifest-source.ts";
import type { RevealDiscoveryState } from "../interaction/preflight-reveal-branches.ts";
import {
  assetRefFor,
  rememberRevealContinuationAsset,
  type RevealContinuationAsset,
} from "./preflight-reveal-continuation-assets.ts";
import {
  contentDigestFor,
  R188_ZERO_DIGEST,
} from "./preflight-reveal-continuation-digests.ts";
import {
  PREFLIGHT_REVEAL_CONTINUATION_VERSION,
  PREFLIGHT_REVEAL_CONTROL,
  PREFLIGHT_REVEAL_REDUCER_CHECKPOINT,
  type RevealControlAsset,
  type RevealExecutionGrant,
  type RevealReducerCheckpoint,
} from "./preflight-reveal-continuation-schemas.ts";
import {
  branchAssetFor,
  candidateListAssetFor,
  candidateListDigestFor,
} from "./receipts/preflight-reveal-continuation-receipt-assets.ts";

const reducerSignatureDigestFor = (signature: string): string =>
  contentDigestFor("reducer-signature", { signature });

const controlAssetFor = (
  control: MatrixPreflightControl,
): RevealControlAsset => {
  const body = {
    artifact: PREFLIGHT_REVEAL_CONTROL,
    version: PREFLIGHT_REVEAL_CONTINUATION_VERSION,
    control,
  } as const;
  const digest = assetRefFor({ ...body, digest: R188_ZERO_DIGEST });
  const asset = { ...body, digest };
  rememberRevealContinuationAsset(asset);
  return freezeDeep(asset);
};

const controlRefsFor = (
  controls: readonly MatrixPreflightControl[],
): readonly string[] =>
  controls.map((control) => controlAssetFor(control).digest);

export const controlsDigestFor = (
  controls: readonly MatrixPreflightControl[],
): string =>
  contentDigestFor("reducer-controls", { refs: controlRefsFor(controls) });

const checkpointRegistrationsFor = (state: RevealDiscoveryState) =>
  [...state.discovered.entries()].map(
    ([identity, value]) =>
      [
        identity,
        {
          signatureDigest: reducerSignatureDigestFor(value.signature),
          pathDigest: value.pathDigest,
          surfaceDigest: value.surfaceDigest,
        },
      ] as const,
  );

const checkpointFor = (
  state: RevealDiscoveryState,
): {
  readonly checkpoint: RevealReducerCheckpoint;
  readonly assets: readonly RevealContinuationAsset[];
} => {
  const controls = state.controls.map(controlAssetFor);
  const queueRefs = state.queue.map((branch) => branchAssetFor(branch).digest);
  const currentBranch = state.currentBranch;
  const currentBranchAsset =
    currentBranch === undefined ? undefined : branchAssetFor(currentBranch);
  const currentCandidates = state.currentCandidates;
  const currentCandidatesAsset =
    currentBranch !== undefined &&
    currentBranchAsset !== undefined &&
    currentCandidates !== undefined
      ? candidateListAssetFor(
          currentBranch,
          currentCandidates,
          currentBranchAsset.digest,
        )
      : undefined;
  const body = {
    artifact: PREFLIGHT_REVEAL_REDUCER_CHECKPOINT,
    version: PREFLIGHT_REVEAL_CONTINUATION_VERSION,
    controls: {
      refs: controls.map(({ digest }) => digest),
      digest: contentDigestFor("reducer-controls", {
        refs: controls.map(({ digest }) => digest),
      }),
      count: controls.length,
    },
    discovered: checkpointRegistrationsFor(state),
    visitedStatePaths: [...state.visitedStatePaths.entries()],
    queueRefs,
    currentBranchRef: currentBranchAsset?.digest ?? null,
    currentCandidatesRef: currentCandidatesAsset?.digest ?? null,
    currentCandidatesDigest:
      currentCandidatesAsset === undefined || currentCandidates === undefined
        ? null
        : candidateListDigestFor(
            currentCandidatesAsset.candidates.map(
              ({ candidateId }) => candidateId,
            ),
          ),
    currentCandidateIndex: state.currentCandidateIndex ?? null,
    actionCount: state.actionCount,
    branchCount: state.branchCount,
  } as const;
  const checkpoint = {
    ...body,
    digest: assetRefFor({ ...body, digest: R188_ZERO_DIGEST }),
  } satisfies RevealReducerCheckpoint;
  rememberRevealContinuationAsset(checkpoint);
  return {
    checkpoint: freezeDeep(checkpoint),
    assets: [
      checkpoint,
      ...controls,
      ...(currentCandidatesAsset === undefined ? [] : [currentCandidatesAsset]),
    ],
  };
};

export const reducerStateSnapshotFor = (
  state: RevealDiscoveryState,
): RevealExecutionGrant["reducerState"] => ({
  checkpointRef: checkpointFor(state).checkpoint.digest,
});

export const reducerStateDigestFor = (state: RevealDiscoveryState): string =>
  checkpointFor(state).checkpoint.digest;

export const reducerCheckpointAssetsFor = (
  state: RevealDiscoveryState,
): readonly RevealContinuationAsset[] => checkpointFor(state).assets;
