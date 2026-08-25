import type { LiveControlPlan } from "../../../replay/live-control/live-control-planning.ts";
import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import type {
  RevealBootstrap,
  RevealContinuationReceipt,
} from "../continuation/contracts/preflight-reveal-continuation-schemas.ts";
import {
  branchAssetFor,
  candidateListAssetFor,
  candidateListDigestFor,
} from "../continuation/receipts/preflight-reveal-continuation-receipt-assets.ts";
import type { RevealReductionContext } from "../guards/preflight-reveal-reduction-context.ts";
import type {
  RevealBranch,
  RevealDiscoveryState,
} from "../interaction/preflight-reveal-branches.ts";
import { revealCandidateIdentityFor } from "../interaction/preflight-reveal-candidate-identity.ts";
import type { RevealFailureFrontierPacket } from "./preflight-reveal-failure-frontier-io.ts";

export const receiptChainFor = (
  values: readonly unknown[],
  parseReceipt: (value: unknown) => RevealContinuationReceipt,
): readonly RevealContinuationReceipt[] => {
  const receipts = values.map(parseReceipt);
  receipts.forEach((receipt, index) => {
    const predecessor = receipts[index - 1]?.digest ?? null;
    if (
      receipt.sequence !== index + 1 ||
      receipt.predecessorDigest !== predecessor
    )
      throw new Error("receipt chain is missing, reordered, or duplicated");
  });
  return receipts;
};

export const receiptChainDigestFor = (
  receipts: readonly RevealContinuationReceipt[],
): string =>
  sha256Hex(
    receipts.map(({ digest, sequence, predecessorDigest }) => ({
      digest,
      sequence,
      predecessorDigest,
    })),
  );

export const sourceFrontierDigestFor = (input: {
  readonly source: SourceArtifact;
  readonly context: RevealReductionContext;
  readonly current: RevealBranch;
  readonly branch: RevealBranch;
  readonly ordinaryPlans: readonly LiveControlPlan[];
  readonly reducerStateDigest: string;
  readonly receiptChainDigest: string;
  readonly packetManifestDigest: string;
}): string =>
  sha256Hex({
    sourceSha: input.source.sourceSha,
    sourceTree: input.source.sourceTree,
    treeDigest: input.source.treeDigest,
    sourceDigest: input.source.sourceDigest,
    planDigest: input.source.plan.digest,
    selectorDigest: input.context.selectorDigest,
    stateDigest: input.context.stateDigest,
    reducerStateDigest: input.reducerStateDigest,
    receiptChainDigest: input.receiptChainDigest,
    packetManifestDigest: input.packetManifestDigest,
    currentPathDigest: input.current.path.digest,
    branchPathDigest: input.branch.path.digest,
    branchSurfaceDigest: input.branch.surface.digest,
    ordinaryPlansDigest: sha256Hex(input.ordinaryPlans),
    maxControlsPerSegment: input.source.matrixLimits.maxControlsPerSegment,
  });

export const packetFrontierAssetsMatch = (input: {
  readonly packet: RevealFailureFrontierPacket;
  readonly branch: RevealBranch;
  readonly candidates: NonNullable<RevealDiscoveryState["currentCandidates"]>;
}): boolean => {
  const { packet, branch, candidates } = input;
  if (packet.candidates.length !== candidates.length) return false;
  for (const [index, candidate] of candidates.entries()) {
    const recorded = packet.candidates[index];
    if (
      recorded === undefined ||
      stableSerialize(recorded.action) !== stableSerialize(candidate.action) ||
      stableSerialize(recorded.representativeInput) !==
        stableSerialize(candidate.representativeInput ?? null) ||
      recorded.candidateId !==
        revealCandidateIdentityFor({
          branch,
          candidate,
        })
    )
      return false;
  }
  const branchAsset = branchAssetFor(branch);
  const candidateListAsset = candidateListAssetFor(
    branch,
    candidates,
    branchAsset.digest,
  );
  const manifest = packet.manifest;
  return (
    manifest.branchRef === branchAsset.digest &&
    manifest.branchDigest === branchAsset.digest &&
    manifest.pathNodeRef === branchAsset.pathNodeRef &&
    manifest.pathDigest === branchAsset.pathDigest &&
    manifest.inventoryRef === branchAsset.inventoryRef &&
    manifest.inventoryDigest === branchAsset.inventoryDigest &&
    manifest.surfaceRef === branchAsset.surfaceRef &&
    manifest.surfaceDigest === branchAsset.surfaceDigest &&
    manifest.candidateListRef === candidateListAsset.digest &&
    manifest.candidateListDigest ===
      candidateListDigestFor(
        candidateListAsset.candidates.map(({ candidateId }) => candidateId),
      ) &&
    stableSerialize(packet.candidates) ===
      stableSerialize(candidateListAsset.candidates)
  );
};

export const packetPendingBranchAssetsMatch = (
  packet: RevealFailureFrontierPacket,
): boolean => {
  const { manifest, pendingBranch } = packet;
  if (pendingBranch === undefined || manifest.pendingBranchRef === undefined)
    return (
      pendingBranch === undefined && manifest.pendingBranchRef === undefined
    );
  const branchAsset = branchAssetFor(pendingBranch);
  return (
    manifest.pendingBranchRef === branchAsset.digest &&
    manifest.pendingBranchDigest === branchAsset.digest &&
    manifest.pendingPathNodeRef === branchAsset.pathNodeRef &&
    manifest.pendingPathDigest === branchAsset.pathDigest &&
    manifest.pendingInventoryRef === branchAsset.inventoryRef &&
    manifest.pendingInventoryDigest === branchAsset.inventoryDigest &&
    manifest.pendingSurfaceRef === branchAsset.surfaceRef &&
    manifest.pendingSurfaceDigest === branchAsset.surfaceDigest
  );
};

export const bootstrapGenesisMatches = (input: {
  readonly bootstrap: RevealBootstrap;
  readonly packet: RevealFailureFrontierPacket;
}): boolean => {
  const { bootstrap, packet } = input;
  const { manifest } = packet;
  return (
    stableSerialize(bootstrap.genesis) ===
    stableSerialize({
      inventoryRef: manifest.inventoryRef,
      inventoryDigest: manifest.inventoryDigest,
      surfaceRef: manifest.surfaceRef,
      surfaceDigest: manifest.surfaceDigest,
      pathNodeRef: manifest.pathNodeRef,
      pathDigest: manifest.pathDigest,
      branchRef: manifest.branchRef,
      branchDigest: manifest.branchDigest,
      candidateListRef: manifest.candidateListRef,
      candidateListDigest: manifest.candidateListDigest,
      url: packet.branch.url,
    })
  );
};
