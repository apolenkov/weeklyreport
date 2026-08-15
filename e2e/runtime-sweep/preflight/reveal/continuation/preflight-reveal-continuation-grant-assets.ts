import {
  rememberedRevealContinuationAsset,
  type RevealContinuationAsset,
} from "./preflight-reveal-continuation-assets.ts";
import { RevealContinuationError } from "./preflight-reveal-continuation-errors.ts";
import {
  PREFLIGHT_REVEAL_BRANCH,
  PREFLIGHT_REVEAL_CANDIDATE_LIST,
  PREFLIGHT_REVEAL_CONTROL,
  PREFLIGHT_REVEAL_INVENTORY,
  PREFLIGHT_REVEAL_PATH_NODE,
  PREFLIGHT_REVEAL_REDUCER_CHECKPOINT,
  PREFLIGHT_REVEAL_SURFACE,
  type RevealExecutionGrant,
} from "./preflight-reveal-continuation-schemas.ts";

const requiredAsset = (
  artifact: RevealContinuationAsset["artifact"],
  ref: string,
): RevealContinuationAsset => {
  const asset = rememberedRevealContinuationAsset({ artifact, ref });
  if (asset === undefined)
    throw new RevealContinuationError(
      `R188 required ${artifact} asset is unavailable: ${ref}`,
    );
  return asset;
};

const addRequired = (
  assets: Map<string, RevealContinuationAsset>,
  artifact: RevealContinuationAsset["artifact"],
  ref: string,
): RevealContinuationAsset => {
  const asset = requiredAsset(artifact, ref);
  assets.set(`${asset.artifact}:${asset.digest}`, asset);
  return asset;
};

const addPathAssets = (
  assets: Map<string, RevealContinuationAsset>,
  ref: string,
  seen = new Set<string>(),
): void => {
  if (seen.has(ref))
    throw new RevealContinuationError(
      "R188 path-node asset chain contains a cycle",
    );
  seen.add(ref);
  const node = addRequired(assets, PREFLIGHT_REVEAL_PATH_NODE, ref);
  if (node.artifact !== PREFLIGHT_REVEAL_PATH_NODE)
    throw new RevealContinuationError("R188 path-node asset type drifted");
  addRequired(assets, PREFLIGHT_REVEAL_SURFACE, node.surfaceRef);
  if (node.step !== null) {
    addRequired(
      assets,
      PREFLIGHT_REVEAL_SURFACE,
      node.step.beforeSurfaceDigest,
    );
    addRequired(assets, PREFLIGHT_REVEAL_SURFACE, node.step.afterSurfaceDigest);
  }
  if (node.parentPathDigest !== null)
    addPathAssets(assets, node.parentPathDigest, seen);
};

const addBranchAssets = (
  assets: Map<string, RevealContinuationAsset>,
  ref: string,
): void => {
  const branch = addRequired(assets, PREFLIGHT_REVEAL_BRANCH, ref);
  if (branch.artifact !== PREFLIGHT_REVEAL_BRANCH)
    throw new RevealContinuationError("R188 branch asset type drifted");
  addRequired(assets, PREFLIGHT_REVEAL_INVENTORY, branch.inventoryRef);
  addRequired(assets, PREFLIGHT_REVEAL_SURFACE, branch.surfaceRef);
  addPathAssets(assets, branch.pathNodeRef);
};

const addFrontierAssets = (
  assets: Map<string, RevealContinuationAsset>,
  frontier: RevealExecutionGrant["frontier"] | RevealExecutionGrant["genesis"],
): void => {
  addRequired(assets, PREFLIGHT_REVEAL_INVENTORY, frontier.inventoryRef);
  addRequired(assets, PREFLIGHT_REVEAL_SURFACE, frontier.surfaceRef);
  addPathAssets(assets, frontier.pathNodeRef);
  addBranchAssets(assets, frontier.branchRef);
  addRequired(
    assets,
    PREFLIGHT_REVEAL_CANDIDATE_LIST,
    frontier.candidateListRef,
  );
  if ("queueRefs" in frontier)
    for (const ref of frontier.queueRefs) addBranchAssets(assets, ref);
};

/** Returns the complete content graph needed by a process-separated child. */
export const assetsForGrant = (
  grant: RevealExecutionGrant,
): readonly RevealContinuationAsset[] => {
  const assets = new Map<string, RevealContinuationAsset>();
  addFrontierAssets(assets, grant.genesis);
  addFrontierAssets(assets, grant.frontier);
  for (const asset of reducerCheckpointAssetsForRef(
    grant.reducerState.checkpointRef,
  ))
    assets.set(`${asset.artifact}:${asset.digest}`, asset);
  return [...assets.values()];
};

const reducerCheckpointAssetsForRef = (
  ref: string,
): readonly RevealContinuationAsset[] => {
  const root = requiredAsset(PREFLIGHT_REVEAL_REDUCER_CHECKPOINT, ref);
  if (root.artifact !== PREFLIGHT_REVEAL_REDUCER_CHECKPOINT)
    throw new RevealContinuationError(
      "R192 reducer checkpoint asset type drifted",
    );
  const assets: RevealContinuationAsset[] = [root];
  for (const controlRef of root.controls.refs)
    assets.push(requiredAsset(PREFLIGHT_REVEAL_CONTROL, controlRef));
  if (root.currentCandidatesRef !== null)
    assets.push(
      requiredAsset(
        "PREFLIGHT_REVEAL_CANDIDATE_LIST",
        root.currentCandidatesRef,
      ),
    );
  return assets;
};

export const assetsForGenesis = (
  genesis: RevealExecutionGrant["genesis"],
): readonly RevealContinuationAsset[] => {
  const assets = new Map<string, RevealContinuationAsset>();
  addFrontierAssets(assets, genesis);
  return [...assets.values()];
};
