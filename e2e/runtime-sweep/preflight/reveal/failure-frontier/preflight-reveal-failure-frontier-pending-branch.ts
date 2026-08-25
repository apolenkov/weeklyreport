import { stableSerialize } from "../../../support/ids.ts";
import type {
  RevealBranchAsset,
  RevealCandidateList,
} from "../continuation/contracts/preflight-reveal-continuation-schemas.ts";
import type { RevealBranch } from "../interaction/preflight-reveal-branches.ts";
import {
  RevealFailureFrontierError,
  type RevealFailureFrontierManifest,
} from "./preflight-reveal-failure-frontier-contract.ts";

export const pendingBranchManifestFieldsFor = (
  pendingBranch: RevealBranchAsset | undefined,
) =>
  pendingBranch === undefined
    ? {}
    : {
        pendingBranchRef: pendingBranch.digest,
        pendingBranchDigest: pendingBranch.digest,
        pendingPathNodeRef: pendingBranch.pathNodeRef,
        pendingPathDigest: pendingBranch.pathDigest,
        pendingInventoryRef: pendingBranch.inventoryRef,
        pendingInventoryDigest: pendingBranch.inventoryDigest,
        pendingSurfaceRef: pendingBranch.surfaceRef,
        pendingSurfaceDigest: pendingBranch.surfaceDigest,
      };

export const assertFailureFrontierPendingManifestBindings = (input: {
  readonly manifest: RevealFailureFrontierManifest;
  readonly branch: RevealBranchAsset;
  readonly pendingBranch?: RevealBranchAsset | undefined;
}): void => {
  const { manifest, branch, pendingBranch } = input;
  const pendingValues = [
    manifest.pendingBranchRef,
    manifest.pendingBranchDigest,
    manifest.pendingPathNodeRef,
    manifest.pendingPathDigest,
    manifest.pendingInventoryRef,
    manifest.pendingInventoryDigest,
    manifest.pendingSurfaceRef,
    manifest.pendingSurfaceDigest,
  ];
  const hasPendingBindings = pendingValues.every(
    (value) => value !== undefined,
  );
  if (pendingValues.some((value) => value !== undefined) !== hasPendingBindings)
    throw new RevealFailureFrontierError(
      "Failure-frontier pending-branch binding is incomplete",
    );
  if (hasPendingBindings !== (pendingBranch !== undefined))
    throw new RevealFailureFrontierError(
      "Failure-frontier pending-branch asset presence drifted",
    );
  if (pendingBranch === undefined) return;
  const pendingBindings = [
    manifest.pendingBranchRef === pendingBranch.digest,
    manifest.pendingBranchDigest === pendingBranch.digest,
    manifest.pendingPathNodeRef === pendingBranch.pathNodeRef,
    manifest.pendingPathDigest === pendingBranch.pathDigest,
    manifest.pendingInventoryRef === pendingBranch.inventoryRef,
    manifest.pendingInventoryDigest === pendingBranch.inventoryDigest,
    manifest.pendingSurfaceRef === pendingBranch.surfaceRef,
    manifest.pendingSurfaceDigest === pendingBranch.surfaceDigest,
  ];
  if (pendingBindings.includes(false))
    throw new RevealFailureFrontierError(
      "Failure-frontier pending-branch asset binding drifted",
    );
  if (pendingBranch.depth !== branch.depth + 1)
    throw new RevealFailureFrontierError(
      "Failure-frontier pending branch is not the next terminal depth",
    );
  if (pendingBranch.depth > manifest.limits.maxDepth)
    throw new RevealFailureFrontierError(
      "Failure-frontier pending branch exceeds the depth bound",
    );
};

export const assertFailureFrontierPendingBranchBinding = (input: {
  readonly branch: RevealBranch;
  readonly pendingBranch: RevealBranch;
  readonly candidate: RevealCandidateList["candidates"][number];
}): void => {
  const { branch, pendingBranch, candidate } = input;
  const terminalStep = pendingBranch.path.steps.at(-1);
  const prefix = pendingBranch.path.steps.slice(0, -1);
  if (terminalStep === undefined)
    throw new RevealFailureFrontierError(
      "Failure-frontier pending branch has no terminal step",
    );
  if (
    pendingBranch.path.initialUrl !== branch.path.initialUrl ||
    stableSerialize(prefix) !== stableSerialize(branch.path.steps) ||
    terminalStep.beforeUrl !== branch.url ||
    terminalStep.afterUrl !== pendingBranch.url ||
    stableSerialize(terminalStep.before) !== stableSerialize(branch.surface) ||
    stableSerialize(terminalStep.after) !==
      stableSerialize(pendingBranch.surface)
  )
    throw new RevealFailureFrontierError(
      "Failure-frontier pending branch is not bound to the current frontier",
    );
  const {
    before: _before,
    after: _after,
    beforeUrl: _beforeUrl,
    afterUrl: _afterUrl,
    nonMutation: _nonMutation,
    representativeInput: _representativeInput,
    ...action
  } = terminalStep;
  if (
    stableSerialize(action) !== stableSerialize(candidate.action) ||
    stableSerialize(terminalStep.representativeInput ?? null) !==
      stableSerialize(candidate.representativeInput)
  )
    throw new RevealFailureFrontierError(
      "Failure-frontier pending branch terminal action drifted",
    );
};
