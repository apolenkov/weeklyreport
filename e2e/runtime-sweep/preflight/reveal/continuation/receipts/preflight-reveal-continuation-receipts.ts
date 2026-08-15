import { freezeDeep } from "../../../../source/manifest-source.ts";
import { stableSerialize } from "../../../../support/ids.ts";
import { canonicalRevealUrlFor } from "../../../reveal-path.ts";
import type {
  RevealBranch,
  RevealCandidate,
  RevealCandidateTerminalResult,
  RevealDiscoveryState,
} from "../../interaction/preflight-reveal-branches.ts";
import {
  assetRefFor,
  rememberedRevealContinuationAsset,
  type RevealContinuationAsset,
} from "../preflight-reveal-continuation-assets.ts";
import { receiptDigestForBody } from "../preflight-reveal-continuation-digests.ts";
import { RevealContinuationError } from "../preflight-reveal-continuation-errors.ts";
import {
  PREFLIGHT_REVEAL_BRANCH,
  PREFLIGHT_REVEAL_CONTINUATION_VERSION,
  PREFLIGHT_REVEAL_SURFACE,
  PREFLIGHT_REVEAL_TERMINAL_RECEIPT,
  receiptSchema,
  type RevealContinuationFrontier,
  type RevealContinuationReceipt,
} from "../preflight-reveal-continuation-schemas.ts";
import {
  branchAssetFor,
  candidateFrontierFor,
  candidateListAssetFor,
  candidateListDigestFor,
  inventoryAssetFor,
  pathNodeAssetsFor,
  revealCandidateIdsFor,
  surfaceAssetFor,
} from "./preflight-reveal-continuation-receipt-assets.ts";
import { terminalBranchFor } from "./preflight-reveal-continuation-receipt-refs.ts";

export {
  assetsForReceipt,
  branchForRef,
  terminalBranchFor,
} from "./preflight-reveal-continuation-receipt-refs.ts";

const assertAssetDigest = (asset: RevealContinuationAsset): void => {
  if (assetRefFor(asset) !== asset.digest)
    throw new RevealContinuationError(
      "R188 asset reference does not match contents",
    );
};

const terminalAssetBindingMatches = (input: {
  readonly receipt: RevealContinuationReceipt;
  readonly asset: Extract<
    RevealContinuationAsset,
    { readonly artifact: typeof PREFLIGHT_REVEAL_BRANCH }
  >;
  readonly branch: RevealBranch;
}): boolean =>
  [
    input.asset.inventoryRef === input.receipt.terminal.postActionInventoryRef,
    input.asset.inventoryDigest ===
      input.receipt.terminal.postActionInventoryDigest,
    input.asset.pathNodeRef === input.receipt.terminal.pathNodeRef,
    input.asset.pathDigest === input.receipt.terminal.pathDigest,
    input.asset.surfaceRef === input.receipt.terminal.surfaceRef,
    input.asset.surfaceDigest === input.receipt.terminal.surfaceDigest,
    input.asset.url === input.receipt.terminal.url,
    input.receipt.transition.afterSurfaceDigest ===
      input.receipt.terminal.surfaceDigest,
    input.receipt.transition.afterUrl === input.receipt.terminal.url,
    input.branch.surface.digest === input.receipt.terminal.surfaceDigest,
    input.branch.path.digest === input.receipt.terminal.pathDigest,
    input.branch.url === input.receipt.terminal.url,
  ].every(Boolean);

const terminalTransitionBindingMatches = (
  receipt: RevealContinuationReceipt,
): boolean =>
  [
    stableSerialize(receipt.transition.action) ===
      stableSerialize(receipt.action),
    stableSerialize(receipt.transition.representativeInput) ===
      stableSerialize(receipt.representativeInput),
  ].every(Boolean);

const materialTerminalBindingMatches = (
  receipt: RevealContinuationReceipt,
  branch: RevealBranch,
): boolean => {
  const lastStep = branch.path.steps.at(-1);
  return (
    lastStep?.after.digest === receipt.terminal.surfaceDigest &&
    lastStep.afterUrl === receipt.terminal.url
  );
};

export const assertTerminalReceiptSemantics = (
  receipt: RevealContinuationReceipt,
): void => {
  const terminalBranchAsset = rememberedRevealContinuationAsset({
    artifact: PREFLIGHT_REVEAL_BRANCH,
    ref: receipt.terminal.terminalBranchRef,
  });
  if (terminalBranchAsset === undefined)
    throw new RevealContinuationError(
      "R188 terminal branch content reference is unavailable",
    );
  if (terminalBranchAsset.artifact !== PREFLIGHT_REVEAL_BRANCH)
    throw new RevealContinuationError(
      "R188 terminal branch asset type drifted",
    );
  assertAssetDigest(terminalBranchAsset);
  const terminalBranch = terminalBranchFor(receipt);
  const surface = rememberedRevealContinuationAsset({
    artifact: PREFLIGHT_REVEAL_SURFACE,
    ref: receipt.terminal.surfaceRef,
  });
  if (surface === undefined)
    throw new RevealContinuationError(
      "R188 terminal surface content reference is unavailable",
    );
  assertAssetDigest(surface);
  if (
    !terminalAssetBindingMatches({
      receipt,
      asset: terminalBranchAsset,
      branch: terminalBranch,
    }) ||
    !terminalTransitionBindingMatches(receipt)
  )
    throw new RevealContinuationError(
      "R188 receipt terminal transition binding drifted",
    );
  if (
    receipt.materialChanged &&
    !materialTerminalBindingMatches(receipt, terminalBranch)
  )
    throw new RevealContinuationError(
      "R188 material terminal branch is not bound to its path leaf",
    );
};

interface TerminalReceiptInput {
  readonly terminal: RevealCandidateTerminalResult;
  readonly branch: Pick<RevealBranch, "path" | "surface" | "url" | "inventory">;
  readonly candidates: readonly RevealCandidate[];
  readonly sequence: number;
  readonly predecessorDigest: string | null;
  readonly completedCandidateCount: number;
  readonly actionCount: number;
  readonly branchCount: number;
  readonly nextFrontier?: Readonly<{
    readonly branch: RevealBranch;
    readonly candidates: readonly RevealCandidate[];
  }>;
}

const terminalReceiptAssetsFor = (input: TerminalReceiptInput) => {
  const beforeBranch: RevealBranch = {
    ...input.branch,
    preparation: undefined,
  };
  const beforeAsset = branchAssetFor(beforeBranch);
  const candidateList = candidateListAssetFor(
    beforeBranch,
    input.candidates,
    beforeAsset.digest,
  );
  const afterBranch = input.terminal.result.branch;
  const afterAsset = branchAssetFor(afterBranch);
  const afterInventory = inventoryAssetFor(afterBranch.inventory);
  const afterSurface = surfaceAssetFor(afterBranch.surface);
  const afterPath = pathNodeAssetsFor(afterBranch.path, afterBranch.surface);
  const ids = revealCandidateIdsFor(beforeBranch, input.candidates);
  const candidateId = ids[input.terminal.candidateIndex];
  if (candidateId === undefined)
    throw new RevealContinuationError(
      "R188 terminal candidate index is out of range",
    );
  const nextFrontier =
    input.nextFrontier === undefined
      ? null
      : candidateFrontierFor(input.nextFrontier);
  return {
    afterAsset,
    afterBranch,
    afterInventory,
    afterPath,
    afterSurface,
    beforeAsset,
    candidateId,
    candidateList,
    ids,
    nextFrontier,
  };
};

export const receiptForTerminal = (
  input: TerminalReceiptInput,
): RevealContinuationReceipt => {
  const {
    afterAsset,
    afterBranch,
    afterInventory,
    afterPath,
    afterSurface,
    beforeAsset,
    candidateId,
    candidateList,
    ids,
    nextFrontier,
  } = terminalReceiptAssetsFor(input);
  const body = {
    artifact: PREFLIGHT_REVEAL_TERMINAL_RECEIPT,
    version: PREFLIGHT_REVEAL_CONTINUATION_VERSION,
    sequence: input.sequence,
    predecessorDigest: input.predecessorDigest,
    branchRef: beforeAsset.digest,
    branchDigest: beforeAsset.digest,
    pathNodeRef: beforeAsset.pathNodeRef,
    pathDigest: beforeAsset.pathDigest,
    candidateListRef: candidateList.digest,
    candidateListDigest: candidateListDigestFor(ids),
    candidateIndex: input.terminal.candidateIndex,
    candidateId,
    action: input.terminal.candidate.action,
    representativeInput: input.terminal.candidate.representativeInput ?? null,
    transition: input.terminal.result.transition,
    terminal: {
      terminalBranchRef: afterAsset.digest,
      postActionInventoryRef: afterInventory.digest,
      postActionInventoryDigest: afterInventory.digest,
      pathNodeRef: afterPath.node.digest,
      pathDigest: afterBranch.path.digest,
      surfaceRef: afterSurface.digest,
      surfaceDigest: afterBranch.surface.digest,
      url: canonicalRevealUrlFor(afterBranch.url),
      nonMutation: input.terminal.result.transition.nonMutation,
      enqueuedBranchRef: input.terminal.materialChanged
        ? afterAsset.digest
        : null,
    },
    nextFrontier,
    materialChanged: input.terminal.materialChanged,
    actionCount: input.actionCount,
    branchCount: input.branchCount,
    completedCandidateCount: input.completedCandidateCount,
  } as const;
  const digest = receiptDigestForBody(body);
  const receipt = receiptSchema.parse({ ...body, digest });
  assertTerminalReceiptSemantics(receipt);
  return freezeDeep(receipt);
};

export const frontierFor = (input: {
  readonly state: RevealDiscoveryState;
  readonly currentBranch: RevealBranch;
  readonly candidates: readonly RevealCandidate[];
  readonly nextCandidateIndex: number;
  readonly completedCandidateCount: number;
}): RevealContinuationFrontier => {
  const branch = branchAssetFor(input.currentBranch);
  const candidateList = candidateListAssetFor(
    input.currentBranch,
    input.candidates,
    branch.digest,
  );
  const nextCandidateId =
    candidateList.candidates[input.nextCandidateIndex]?.candidateId;
  if (nextCandidateId === undefined)
    throw new RevealContinuationError("R188 frontier has no next candidate");
  const inventory = inventoryAssetFor(input.currentBranch.inventory);
  const surface = surfaceAssetFor(input.currentBranch.surface);
  const pathNode = pathNodeAssetsFor(
    input.currentBranch.path,
    input.currentBranch.surface,
  );
  const queueRefs = input.state.queue.map(
    (queuedBranch) => branchAssetFor(queuedBranch).digest,
  );
  return {
    branchRef: branch.digest,
    branchDigest: branch.digest,
    pathNodeRef: pathNode.node.digest,
    pathDigest: input.currentBranch.path.digest,
    inventoryRef: inventory.digest,
    inventoryDigest: inventory.digest,
    surfaceRef: surface.digest,
    surfaceDigest: input.currentBranch.surface.digest,
    url: canonicalRevealUrlFor(input.currentBranch.url),
    candidateListRef: candidateList.digest,
    candidateListDigest: candidateListDigestFor(
      candidateList.candidates.map((candidate) => candidate.candidateId),
    ),
    queueRefs,
    nextCandidateIndex: input.nextCandidateIndex,
    nextCandidateId,
    actionCount: input.state.actionCount,
    branchCount: input.state.branchCount,
    completedCandidateCount: input.completedCandidateCount,
  };
};
