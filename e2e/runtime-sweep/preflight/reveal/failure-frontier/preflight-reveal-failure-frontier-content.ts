import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import type { CapacitySurveyPlan } from "../../capacity/preflight-capacity-survey-contract.ts";
import {
  rememberedRevealContinuationAsset,
  type RevealContinuationAsset,
} from "../continuation/preflight-reveal-continuation-assets.ts";
import {
  PREFLIGHT_REVEAL_BRANCH,
  PREFLIGHT_REVEAL_CANDIDATE_LIST,
  PREFLIGHT_REVEAL_INVENTORY,
  PREFLIGHT_REVEAL_PATH_NODE,
  PREFLIGHT_REVEAL_SURFACE,
  type RevealBranchAsset,
  type RevealCandidateList,
} from "../continuation/preflight-reveal-continuation-schemas.ts";
import { candidateListDigestFor } from "../continuation/receipts/preflight-reveal-continuation-receipt-assets.ts";
import type { RevealCandidateFailure } from "../interaction/preflight-reveal-branches.ts";
import {
  createRevealFailureFrontierManifest,
  FAILURE_FRONTIER_LIMITS,
  PREFLIGHT_REVEAL_FAILURE_FRONTIER,
  PREFLIGHT_REVEAL_FAILURE_FRONTIER_AUTHORITY,
  PREFLIGHT_REVEAL_FAILURE_FRONTIER_VERSION,
  type RevealFailureFrontierAssetDescriptor,
  RevealFailureFrontierError,
  type RevealFailureFrontierManifest,
} from "./preflight-reveal-failure-frontier-contract.ts";
import {
  assertFailureFrontierPendingManifestBindings,
  pendingBranchManifestFieldsFor,
} from "./preflight-reveal-failure-frontier-pending-branch.ts";

const isFrontierAsset = (
  asset: RevealContinuationAsset,
): asset is Extract<
  RevealContinuationAsset,
  {
    artifact:
      | typeof PREFLIGHT_REVEAL_BRANCH
      | typeof PREFLIGHT_REVEAL_CANDIDATE_LIST
      | typeof PREFLIGHT_REVEAL_INVENTORY
      | typeof PREFLIGHT_REVEAL_PATH_NODE
      | typeof PREFLIGHT_REVEAL_SURFACE;
  }
> => {
  switch (asset.artifact) {
    case PREFLIGHT_REVEAL_BRANCH:
    case PREFLIGHT_REVEAL_CANDIDATE_LIST:
    case PREFLIGHT_REVEAL_INVENTORY:
    case PREFLIGHT_REVEAL_PATH_NODE:
    case PREFLIGHT_REVEAL_SURFACE:
      return true;
    default:
      return false;
  }
};

const failureFrontierDescriptorFor = (
  asset: RevealContinuationAsset,
): RevealFailureFrontierAssetDescriptor => {
  if (!isFrontierAsset(asset))
    throw new RevealFailureFrontierError(
      `Unsupported failure-frontier content asset: ${asset.artifact}`,
    );
  const bytes = Buffer.byteLength(`${stableSerialize(asset)}\n`, "utf8");
  if (bytes > FAILURE_FRONTIER_LIMITS.maxAssetBytes)
    throw new RevealFailureFrontierError(
      "Failure-frontier content asset exceeds the per-file byte bound",
    );
  return { artifact: asset.artifact, ref: asset.digest, bytes };
};

export const canonicalFailureFrontierAssets = (
  assets: readonly RevealContinuationAsset[],
): readonly RevealContinuationAsset[] =>
  assets.toSorted((left, right) =>
    `${left.artifact}:${left.digest}`.localeCompare(
      `${right.artifact}:${right.digest}`,
    ),
  );

export const requiredFailureFrontierBranch = (
  ref: string,
): RevealBranchAsset => {
  const asset = rememberedRevealContinuationAsset({
    artifact: PREFLIGHT_REVEAL_BRANCH,
    ref,
  });
  if (asset?.artifact !== PREFLIGHT_REVEAL_BRANCH)
    throw new RevealFailureFrontierError(
      "Failure-frontier branch asset is unavailable",
    );
  return asset;
};

export const requiredFailureFrontierCandidates = (
  ref: string,
): RevealCandidateList => {
  const asset = rememberedRevealContinuationAsset({
    artifact: PREFLIGHT_REVEAL_CANDIDATE_LIST,
    ref,
  });
  if (asset?.artifact !== PREFLIGHT_REVEAL_CANDIDATE_LIST)
    throw new RevealFailureFrontierError(
      "Failure-frontier candidate-list asset is unavailable",
    );
  return asset;
};

const failureClassificationFor = (error: unknown) => {
  const name = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : String(error);
  return {
    kind: error instanceof Error ? ("error" as const) : ("non-error" as const),
    nameDigest: sha256Hex(name),
    messageDigest: sha256Hex(message),
  };
};

export const failureFrontierManifestFor = (input: {
  readonly plan: CapacitySurveyPlan;
  readonly failure: RevealCandidateFailure;
  readonly branch: RevealBranchAsset;
  readonly pendingBranch?: RevealBranchAsset | undefined;
  readonly candidates: RevealCandidateList;
  readonly assets: readonly RevealContinuationAsset[];
}): RevealFailureFrontierManifest => {
  if (input.branch.depth > FAILURE_FRONTIER_LIMITS.maxDepth)
    throw new RevealFailureFrontierError(
      "Failure-frontier branch exceeds the depth bound",
    );
  if (input.assets.length > FAILURE_FRONTIER_LIMITS.maxAssets)
    throw new RevealFailureFrontierError(
      "Failure-frontier packet exceeds the asset-count bound",
    );
  const candidate = input.candidates.candidates[input.failure.candidateIndex];
  if (candidate?.candidateId !== input.failure.candidateIdentity)
    throw new RevealFailureFrontierError(
      "Failure-frontier candidate identity drifted before publication",
    );
  const assets = canonicalFailureFrontierAssets(input.assets).map(
    failureFrontierDescriptorFor,
  );
  return createRevealFailureFrontierManifest({
    artifact: PREFLIGHT_REVEAL_FAILURE_FRONTIER,
    version: PREFLIGHT_REVEAL_FAILURE_FRONTIER_VERSION,
    authority: PREFLIGHT_REVEAL_FAILURE_FRONTIER_AUTHORITY,
    sourceSha: input.plan.sourceSha,
    sourceTree: input.plan.sourceTree,
    treeDigest: input.plan.treeDigest,
    sourceDigest: input.plan.sourceDigest,
    sourcePlanDigest: input.plan.planDigest,
    capacityPlanArtifactDigest: input.plan.planArtifactDigest,
    selectorDigest: input.plan.selector.selectorDigest,
    stateDigest: input.plan.selector.stateDigest,
    routeDigest: sha256Hex(input.plan.route),
    branchRef: input.branch.digest,
    branchDigest: input.branch.digest,
    pathNodeRef: input.branch.pathNodeRef,
    pathDigest: input.branch.pathDigest,
    inventoryRef: input.branch.inventoryRef,
    inventoryDigest: input.branch.inventoryDigest,
    surfaceRef: input.branch.surfaceRef,
    surfaceDigest: input.branch.surfaceDigest,
    candidateListRef: input.candidates.digest,
    candidateListDigest: candidateListDigestFor(
      input.candidates.candidates.map(({ candidateId }) => candidateId),
    ),
    candidateIndex: input.failure.candidateIndex,
    candidateIdentity: input.failure.candidateIdentity,
    ...pendingBranchManifestFieldsFor(input.pendingBranch),
    representativeInput: candidate.representativeInput,
    actionKeyDigest: sha256Hex(candidate.action.controlKey),
    failure: failureClassificationFor(input.failure.originalError),
    limits: FAILURE_FRONTIER_LIMITS,
    assets,
  });
};

export const assertFailureFrontierClosure = (
  manifest: RevealFailureFrontierManifest,
  assets: readonly RevealContinuationAsset[],
): void => {
  const expected = canonicalFailureFrontierAssets(assets).map(
    failureFrontierDescriptorFor,
  );
  if (stableSerialize(expected) !== stableSerialize(manifest.assets))
    throw new RevealFailureFrontierError(
      "Failure-frontier manifest does not declare its exact asset closure",
    );
};

export const assertFailureFrontierBindings = (input: {
  readonly manifest: RevealFailureFrontierManifest;
  readonly branch: RevealBranchAsset;
  readonly pendingBranch?: RevealBranchAsset | undefined;
  readonly candidates: RevealCandidateList;
}): void => {
  const { manifest, branch, pendingBranch, candidates } = input;
  const candidate = candidates.candidates[manifest.candidateIndex];
  const candidateDigest = candidateListDigestFor(
    candidates.candidates.map(({ candidateId }) => candidateId),
  );
  const bindings = [
    manifest.branchRef === branch.digest,
    manifest.branchDigest === branch.digest,
    manifest.pathNodeRef === branch.pathNodeRef,
    manifest.pathDigest === branch.pathDigest,
    manifest.inventoryRef === branch.inventoryRef,
    manifest.inventoryDigest === branch.inventoryDigest,
    manifest.surfaceRef === branch.surfaceRef,
    manifest.surfaceDigest === branch.surfaceDigest,
    manifest.candidateListRef === candidates.digest,
    manifest.candidateListDigest === candidateDigest,
    candidate?.candidateId === manifest.candidateIdentity,
    stableSerialize(candidate?.representativeInput) ===
      stableSerialize(manifest.representativeInput),
    candidate !== undefined &&
      sha256Hex(candidate.action.controlKey) === manifest.actionKeyDigest,
  ];
  if (bindings.includes(false))
    throw new RevealFailureFrontierError(
      "Failure-frontier branch or candidate binding drifted",
    );
  if (branch.depth > manifest.limits.maxDepth)
    throw new RevealFailureFrontierError(
      "Failure-frontier branch exceeds the depth bound",
    );
  assertFailureFrontierPendingManifestBindings({
    manifest,
    branch,
    ...(pendingBranch === undefined ? {} : { pendingBranch }),
  });
};
