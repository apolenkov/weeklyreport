import {
  readRevealContinuationAsset,
  rememberRevealContinuationAsset,
  type RevealContinuationAsset,
} from "./preflight-reveal-continuation-assets.ts";
import {
  PREFLIGHT_REVEAL_BRANCH,
  PREFLIGHT_REVEAL_CANDIDATE_LIST,
  PREFLIGHT_REVEAL_INVENTORY,
  PREFLIGHT_REVEAL_PATH_NODE,
  PREFLIGHT_REVEAL_SURFACE,
  type RevealBootstrap,
  type RevealContinuationReceipt,
  type RevealExecutionGrant,
  type RevealReceiptChunk,
} from "./preflight-reveal-continuation-schemas.ts";

interface AssetQueue {
  readonly pending: {
    readonly artifact: RevealContinuationAsset["artifact"];
    readonly ref: string;
  }[];
  readonly queued: Set<string>;
}

const queueAsset = (
  queue: AssetQueue,
  artifact: RevealContinuationAsset["artifact"],
  ref: string,
): void => {
  const key = `${artifact}:${ref}`;
  if (queue.queued.has(key)) return;
  queue.queued.add(key);
  queue.pending.push({ artifact, ref });
};

const queueBranch = (queue: AssetQueue, ref: string): void =>
  queueAsset(queue, PREFLIGHT_REVEAL_BRANCH, ref);

const queueGrant = (queue: AssetQueue, grant: RevealExecutionGrant): void => {
  for (const refs of [grant.genesis, grant.frontier]) {
    queueAsset(queue, PREFLIGHT_REVEAL_INVENTORY, refs.inventoryRef);
    queueAsset(queue, PREFLIGHT_REVEAL_SURFACE, refs.surfaceRef);
    queueAsset(queue, PREFLIGHT_REVEAL_PATH_NODE, refs.pathNodeRef);
    queueBranch(queue, refs.branchRef);
    queueAsset(queue, PREFLIGHT_REVEAL_CANDIDATE_LIST, refs.candidateListRef);
  }
  for (const ref of grant.frontier.queueRefs) queueBranch(queue, ref);
};

const queueGenesis = (
  queue: AssetQueue,
  genesis: RevealExecutionGrant["genesis"],
): void => {
  queueAsset(queue, PREFLIGHT_REVEAL_INVENTORY, genesis.inventoryRef);
  queueAsset(queue, PREFLIGHT_REVEAL_SURFACE, genesis.surfaceRef);
  queueAsset(queue, PREFLIGHT_REVEAL_PATH_NODE, genesis.pathNodeRef);
  queueBranch(queue, genesis.branchRef);
  queueAsset(queue, PREFLIGHT_REVEAL_CANDIDATE_LIST, genesis.candidateListRef);
};

const queueReceipt = (
  queue: AssetQueue,
  receipt: RevealContinuationReceipt,
): void => {
  queueBranch(queue, receipt.branchRef);
  queueBranch(queue, receipt.terminal.terminalBranchRef);
  queueAsset(queue, PREFLIGHT_REVEAL_CANDIDATE_LIST, receipt.candidateListRef);
  queueAsset(
    queue,
    PREFLIGHT_REVEAL_INVENTORY,
    receipt.terminal.postActionInventoryRef,
  );
  queueAsset(queue, PREFLIGHT_REVEAL_SURFACE, receipt.terminal.surfaceRef);
  queueAsset(queue, PREFLIGHT_REVEAL_PATH_NODE, receipt.terminal.pathNodeRef);
  if (receipt.terminal.enqueuedBranchRef !== null)
    queueBranch(queue, receipt.terminal.enqueuedBranchRef);
  if (receipt.nextFrontier !== null) {
    queueBranch(queue, receipt.nextFrontier.branchRef);
    queueAsset(
      queue,
      PREFLIGHT_REVEAL_CANDIDATE_LIST,
      receipt.nextFrontier.candidateListRef,
    );
  }
};

const queueChildAssets = (
  queue: AssetQueue,
  asset: RevealContinuationAsset,
): void => {
  if (asset.artifact === PREFLIGHT_REVEAL_BRANCH) {
    queueAsset(queue, PREFLIGHT_REVEAL_INVENTORY, asset.inventoryRef);
    queueAsset(queue, PREFLIGHT_REVEAL_SURFACE, asset.surfaceRef);
    queueAsset(queue, PREFLIGHT_REVEAL_PATH_NODE, asset.pathNodeRef);
    return;
  }
  if (asset.artifact !== PREFLIGHT_REVEAL_PATH_NODE) return;
  queueAsset(queue, PREFLIGHT_REVEAL_SURFACE, asset.surfaceRef);
  if (asset.parentPathDigest !== null)
    queueAsset(queue, PREFLIGHT_REVEAL_PATH_NODE, asset.parentPathDigest);
  if (asset.step !== null) {
    queueAsset(queue, PREFLIGHT_REVEAL_SURFACE, asset.step.beforeSurfaceDigest);
    queueAsset(queue, PREFLIGHT_REVEAL_SURFACE, asset.step.afterSurfaceDigest);
  }
};

/** Loads and validates all content-addressed assets needed by a grant/chunk. */
export const hydrateRevealContinuationAssets = async (input: {
  readonly archiveRoot: string;
  readonly bootstrap?: RevealBootstrap;
  readonly grant?: RevealExecutionGrant;
  readonly chunk?: RevealReceiptChunk;
}): Promise<void> => {
  const queue: AssetQueue = { pending: [], queued: new Set<string>() };
  if (input.bootstrap !== undefined)
    queueGenesis(queue, input.bootstrap.genesis);
  if (input.grant !== undefined) queueGrant(queue, input.grant);
  for (const receipt of input.chunk?.receipts ?? [])
    queueReceipt(queue, receipt);
  while (queue.pending.length > 0) {
    const next = queue.pending.shift();
    if (next === undefined) break;
    const asset = await readRevealContinuationAsset({
      archiveRoot: input.archiveRoot,
      artifact: next.artifact,
      ref: next.ref,
    });
    rememberRevealContinuationAsset(asset);
    queueChildAssets(queue, asset);
  }
};
