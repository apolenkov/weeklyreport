import {
  parseRevealPath,
  parseRevealSurface,
  revealPathFor,
} from "../../../reveal-path.ts";
import type { RevealBranch } from "../../interaction/preflight-reveal-branches.ts";
import {
  rememberedRevealContinuationAsset,
  type RevealContinuationAsset,
} from "../preflight-reveal-continuation-assets.ts";
import { RevealContinuationError } from "../preflight-reveal-continuation-errors.ts";
import { domInventoryFor } from "../preflight-reveal-continuation-inventory.ts";
import {
  PREFLIGHT_REVEAL_BRANCH,
  PREFLIGHT_REVEAL_CANDIDATE_LIST,
  PREFLIGHT_REVEAL_INVENTORY,
  PREFLIGHT_REVEAL_PATH_NODE,
  PREFLIGHT_REVEAL_SURFACE,
  type RevealBranchAsset,
  type RevealContinuationReceipt,
  type RevealPathNode,
} from "../preflight-reveal-continuation-schemas.ts";

const pathNodesFor = (input: {
  readonly node: RevealPathNode;
  readonly seen?: ReadonlySet<string>;
}): readonly RevealPathNode[] => {
  const seen = new Set(input.seen);
  if (seen.has(input.node.digest))
    throw new RevealContinuationError("R188 path-node chain contains a cycle");
  seen.add(input.node.digest);
  if (input.node.parentPathDigest === null) return [input.node];
  const parent = rememberedRevealContinuationAsset({
    artifact: PREFLIGHT_REVEAL_PATH_NODE,
    ref: input.node.parentPathDigest,
  });
  if (parent?.artifact !== PREFLIGHT_REVEAL_PATH_NODE)
    throw new RevealContinuationError(
      "R188 path-node parent content reference is unavailable",
    );
  return [...pathNodesFor({ node: parent, seen }), input.node];
};

const surfaceForRef = (ref: string) => {
  const asset = rememberedRevealContinuationAsset({
    artifact: PREFLIGHT_REVEAL_SURFACE,
    ref,
  });
  if (asset?.artifact !== PREFLIGHT_REVEAL_SURFACE)
    throw new RevealContinuationError(
      "R188 path-node surface content reference is unavailable",
    );
  return parseRevealSurface(asset.surface);
};

const pathForBranch = (
  branch: RevealBranchAsset,
  leaf: RevealPathNode,
): RevealBranch["path"] => {
  const nodes = pathNodesFor({ node: leaf });
  const root = nodes[0];
  if (root?.step !== null)
    throw new RevealContinuationError("R188 path-node chain has no root node");
  if (nodes.some((node, index) => node.depth !== index))
    throw new RevealContinuationError("R188 path-node depth binding drifted");
  const steps = nodes.slice(1).map((node) => {
    if (node.step === null)
      throw new RevealContinuationError(
        "R188 non-root path node has no terminal step",
      );
    if (node.surfaceRef !== node.surfaceDigest)
      throw new RevealContinuationError(
        "R188 path-node surface binding drifted",
      );
    const before = surfaceForRef(node.step.beforeSurfaceDigest);
    const after = surfaceForRef(node.step.afterSurfaceDigest);
    return {
      ...node.step.action,
      before,
      after,
      beforeUrl: node.step.beforeUrl,
      afterUrl: node.step.afterUrl,
      nonMutation: node.step.nonMutation,
      ...(node.step.representativeInput === null
        ? {}
        : { representativeInput: node.step.representativeInput }),
    };
  });
  const parsed = parseRevealPath(revealPathFor(steps, root.url));
  if (parsed.digest !== branch.pathDigest)
    throw new RevealContinuationError("R188 path-node chain digest drifted");
  // A non-exploring terminal branch may leave the declared route. Its
  // exploration path remains the reducer frontier path, while the branch
  // still records the actual terminal URL/surface for receipt validation.
  // Exploring branches are checked against the terminal receipt semantics.
  return parsed;
};

const branchForSerializable = (branch: RevealBranchAsset): RevealBranch => {
  const storedInventory = rememberedRevealContinuationAsset({
    artifact: PREFLIGHT_REVEAL_INVENTORY,
    ref: branch.inventoryRef,
  });
  const storedSurface = rememberedRevealContinuationAsset({
    artifact: PREFLIGHT_REVEAL_SURFACE,
    ref: branch.surfaceRef,
  });
  const storedPath = rememberedRevealContinuationAsset({
    artifact: PREFLIGHT_REVEAL_PATH_NODE,
    ref: branch.pathNodeRef,
  });
  if (
    storedInventory?.artifact !== PREFLIGHT_REVEAL_INVENTORY ||
    storedSurface?.artifact !== PREFLIGHT_REVEAL_SURFACE ||
    storedPath?.artifact !== PREFLIGHT_REVEAL_PATH_NODE
  )
    throw new RevealContinuationError(
      "R188 branch references unavailable content assets",
    );
  if (storedSurface.surface.digest !== branch.surfaceDigest)
    throw new RevealContinuationError("R188 branch surface digest drifted");
  if (storedInventory.digest !== branch.inventoryDigest)
    throw new RevealContinuationError("R188 branch inventory digest drifted");
  const path = pathForBranch(branch, storedPath);
  return {
    path,
    inventory: domInventoryFor(storedInventory.inventory),
    surface: parseRevealSurface(storedSurface.surface),
    url: branch.url,
    preparation: undefined,
  };
};

export const branchForRef = (ref: string): RevealBranch => {
  const asset = rememberedRevealContinuationAsset({
    artifact: PREFLIGHT_REVEAL_BRANCH,
    ref,
  });
  if (asset?.artifact !== PREFLIGHT_REVEAL_BRANCH)
    throw new RevealContinuationError("R188 branch reference is unavailable");
  return branchForSerializable(asset);
};

export const terminalBranchFor = (
  receipt: RevealContinuationReceipt,
): RevealBranch => branchForRef(receipt.terminal.terminalBranchRef);

const addBranchAssets = (
  assets: Map<string, RevealContinuationAsset>,
  ref: string,
): void => {
  const branch = rememberedRevealContinuationAsset({
    artifact: PREFLIGHT_REVEAL_BRANCH,
    ref,
  });
  if (branch?.artifact !== PREFLIGHT_REVEAL_BRANCH) return;
  assets.set(`${branch.artifact}:${branch.digest}`, branch);
  for (const [artifact, assetRef] of [
    [PREFLIGHT_REVEAL_INVENTORY, branch.inventoryRef],
    [PREFLIGHT_REVEAL_SURFACE, branch.surfaceRef],
    [PREFLIGHT_REVEAL_PATH_NODE, branch.pathNodeRef],
  ] as const) {
    addAsset(assets, artifact, assetRef);
  }
  addPathAssets(assets, branch.pathNodeRef);
};

const addAsset = (
  assets: Map<string, RevealContinuationAsset>,
  artifact: RevealContinuationAsset["artifact"],
  ref: string,
): void => {
  const asset = rememberedRevealContinuationAsset({ artifact, ref });
  if (asset !== undefined)
    assets.set(`${asset.artifact}:${asset.digest}`, asset);
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
  const node = rememberedRevealContinuationAsset({
    artifact: PREFLIGHT_REVEAL_PATH_NODE,
    ref,
  });
  if (node?.artifact !== PREFLIGHT_REVEAL_PATH_NODE) return;
  assets.set(`${node.artifact}:${node.digest}`, node);
  addAsset(assets, PREFLIGHT_REVEAL_SURFACE, node.surfaceRef);
  if (node.step !== null) {
    addAsset(assets, PREFLIGHT_REVEAL_SURFACE, node.step.beforeSurfaceDigest);
    addAsset(assets, PREFLIGHT_REVEAL_SURFACE, node.step.afterSurfaceDigest);
  }
  if (node.parentPathDigest !== null)
    addPathAssets(assets, node.parentPathDigest, seen);
};

/** Returns every content-addressed asset directly referenced by one receipt. */
export const assetsForReceipt = (
  receipt: RevealContinuationReceipt,
): readonly RevealContinuationAsset[] => {
  const assets = new Map<string, RevealContinuationAsset>();
  addBranchAssets(assets, receipt.branchRef);
  addBranchAssets(assets, receipt.terminal.terminalBranchRef);
  if (receipt.terminal.enqueuedBranchRef !== null)
    addBranchAssets(assets, receipt.terminal.enqueuedBranchRef);
  if (receipt.nextFrontier !== null) {
    addBranchAssets(assets, receipt.nextFrontier.branchRef);
    addAsset(
      assets,
      PREFLIGHT_REVEAL_CANDIDATE_LIST,
      receipt.nextFrontier.candidateListRef,
    );
  }
  for (const [artifact, ref] of [
    [PREFLIGHT_REVEAL_CANDIDATE_LIST, receipt.candidateListRef],
    [PREFLIGHT_REVEAL_INVENTORY, receipt.terminal.postActionInventoryRef],
    [PREFLIGHT_REVEAL_PATH_NODE, receipt.terminal.pathNodeRef],
    [PREFLIGHT_REVEAL_SURFACE, receipt.terminal.surfaceRef],
  ] as const) {
    const asset = rememberedRevealContinuationAsset({ artifact, ref });
    if (asset !== undefined)
      assets.set(`${asset.artifact}:${asset.digest}`, asset);
  }
  addPathAssets(assets, receipt.terminal.pathNodeRef);
  return [...assets.values()];
};

/** Returns the exact immutable asset closure for one saved candidate frontier. */
export const assetsForCandidateFrontier = (input: {
  readonly branchRef: string;
  readonly candidateListRef: string;
  readonly additionalBranchRefs?: readonly string[] | undefined;
}): readonly RevealContinuationAsset[] => {
  const assets = new Map<string, RevealContinuationAsset>();
  addBranchAssets(assets, input.branchRef);
  for (const branchRef of input.additionalBranchRefs ?? [])
    addBranchAssets(assets, branchRef);
  addAsset(assets, PREFLIGHT_REVEAL_CANDIDATE_LIST, input.candidateListRef);
  return [...assets.values()];
};
