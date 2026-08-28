import {
  PREFLIGHT_REVEAL_BRANCH,
  PREFLIGHT_REVEAL_CANDIDATE_LIST,
  PREFLIGHT_REVEAL_CONTROL,
  PREFLIGHT_REVEAL_INVENTORY,
  PREFLIGHT_REVEAL_PATH_NODE,
  PREFLIGHT_REVEAL_REDUCER_CHECKPOINT,
  PREFLIGHT_REVEAL_SURFACE,
  type RevealBootstrap,
  type RevealContinuationReceipt,
  type RevealExecutionGrant,
  type RevealReceiptChunk,
} from "./contracts/preflight-reveal-continuation-schemas.ts";
import {
  readRevealContinuationAsset,
  rememberRevealContinuationAsset,
  type RevealContinuationAsset,
} from "./preflight-reveal-continuation-assets.ts";

interface AssetQueue {
  readonly pending: {
    readonly artifact: RevealContinuationAsset["artifact"];
    readonly ref: string;
  }[];
  readonly queued: Set<string>;
}

type HydrationScope = "complete" | "execution-frontier";

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

const queueGrant = (
  queue: AssetQueue,
  grant: RevealExecutionGrant,
  scope: HydrationScope,
): void => {
  for (const refs of [grant.genesis, grant.frontier]) {
    queueAsset(queue, PREFLIGHT_REVEAL_INVENTORY, refs.inventoryRef);
    queueAsset(queue, PREFLIGHT_REVEAL_SURFACE, refs.surfaceRef);
    queueAsset(queue, PREFLIGHT_REVEAL_PATH_NODE, refs.pathNodeRef);
    queueBranch(queue, refs.branchRef);
    queueAsset(queue, PREFLIGHT_REVEAL_CANDIDATE_LIST, refs.candidateListRef);
  }
  if (scope === "complete")
    for (const ref of grant.frontier.queueRefs) queueBranch(queue, ref);
  queueAsset(
    queue,
    PREFLIGHT_REVEAL_REDUCER_CHECKPOINT,
    grant.reducerState.checkpointRef,
  );
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

const queueCheckpointChildren = (
  queue: AssetQueue,
  asset: Extract<
    RevealContinuationAsset,
    { readonly artifact: typeof PREFLIGHT_REVEAL_REDUCER_CHECKPOINT }
  >,
): void => {
  for (const ref of asset.controls.refs)
    queueAsset(queue, PREFLIGHT_REVEAL_CONTROL, ref);
  for (const ref of asset.queueRefs) queueBranch(queue, ref);
  if (asset.currentBranchRef !== null)
    queueBranch(queue, asset.currentBranchRef);
  if (asset.currentCandidatesRef !== null)
    queueAsset(
      queue,
      PREFLIGHT_REVEAL_CANDIDATE_LIST,
      asset.currentCandidatesRef,
    );
};

const queuePathChildren = (
  queue: AssetQueue,
  asset: Extract<
    RevealContinuationAsset,
    { readonly artifact: typeof PREFLIGHT_REVEAL_PATH_NODE }
  >,
): void => {
  queueAsset(queue, PREFLIGHT_REVEAL_SURFACE, asset.surfaceRef);
  if (asset.parentPathDigest !== null)
    queueAsset(queue, PREFLIGHT_REVEAL_PATH_NODE, asset.parentPathDigest);
  if (asset.step === null) return;
  queueAsset(queue, PREFLIGHT_REVEAL_SURFACE, asset.step.beforeSurfaceDigest);
  queueAsset(queue, PREFLIGHT_REVEAL_SURFACE, asset.step.afterSurfaceDigest);
};

const queueChildAssets = (
  queue: AssetQueue,
  asset: RevealContinuationAsset,
  scope: HydrationScope,
): void => {
  switch (asset.artifact) {
    case PREFLIGHT_REVEAL_BRANCH:
      queueAsset(queue, PREFLIGHT_REVEAL_INVENTORY, asset.inventoryRef);
      queueAsset(queue, PREFLIGHT_REVEAL_SURFACE, asset.surfaceRef);
      queueAsset(queue, PREFLIGHT_REVEAL_PATH_NODE, asset.pathNodeRef);
      break;
    case PREFLIGHT_REVEAL_REDUCER_CHECKPOINT:
      if (scope === "complete") queueCheckpointChildren(queue, asset);
      break;
    case PREFLIGHT_REVEAL_PATH_NODE:
      queuePathChildren(queue, asset);
      break;
    default:
      break;
  }
};

/** Loads and validates all content-addressed assets needed by a grant/chunk. */
export const hydrateRevealContinuationAssets = async (input: {
  readonly archiveRoot: string;
  readonly bootstrap?: RevealBootstrap;
  readonly grant?: RevealExecutionGrant;
  readonly chunk?: RevealReceiptChunk;
  readonly scope?: HydrationScope;
}): Promise<void> => {
  const scope = input.scope ?? "complete";
  const queue: AssetQueue = { pending: [], queued: new Set<string>() };
  if (input.bootstrap !== undefined)
    queueGenesis(queue, input.bootstrap.genesis);
  if (input.grant !== undefined) queueGrant(queue, input.grant, scope);
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
    queueChildAssets(queue, asset, scope);
  }
};
