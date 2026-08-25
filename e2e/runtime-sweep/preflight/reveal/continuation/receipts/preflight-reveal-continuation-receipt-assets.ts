import type { DomInventory } from "../../../../replay/dom/dom-inventory.ts";
import { freezeDeep } from "../../../../source/manifest-source.ts";
import { sha256Hex } from "../../../../support/ids.ts";
import {
  canonicalRevealUrlFor,
  type RevealPath,
  type RevealSurface,
} from "../../../reveal-path.ts";
import type {
  RevealBranch,
  RevealCandidate,
} from "../../interaction/preflight-reveal-branches.ts";
import { revealCandidateIdsFor } from "../../interaction/preflight-reveal-candidate-identity.ts";
import {
  candidateListSchema,
  PREFLIGHT_REVEAL_BRANCH,
  PREFLIGHT_REVEAL_CANDIDATE_LIST,
  PREFLIGHT_REVEAL_CONTINUATION_VERSION,
  PREFLIGHT_REVEAL_INVENTORY,
  PREFLIGHT_REVEAL_PATH_NODE,
  PREFLIGHT_REVEAL_SURFACE,
  type RevealBranchAsset,
  type RevealCandidateList,
  type RevealPathNode,
} from "../contracts/preflight-reveal-continuation-schemas.ts";
import {
  assetRefFor,
  rememberRevealContinuationAsset,
  type RevealContinuationAsset,
} from "../preflight-reveal-continuation-assets.ts";
import { R188_ZERO_DIGEST } from "../preflight-reveal-continuation-digests.ts";
import { serializableInventoryFor } from "../preflight-reveal-continuation-inventory.ts";

export {
  revealCandidateIdentityFor,
  revealCandidateIdsFor,
} from "../../interaction/preflight-reveal-candidate-identity.ts";

export const candidateListDigestFor = (ids: readonly string[]): string =>
  sha256Hex(ids);

const remember = (asset: RevealContinuationAsset): string =>
  rememberRevealContinuationAsset(asset);

export const inventoryAssetFor = (inventory: DomInventory) => {
  const serializable = serializableInventoryFor(inventory);
  const body = {
    artifact: PREFLIGHT_REVEAL_INVENTORY,
    version: PREFLIGHT_REVEAL_CONTINUATION_VERSION,
    inventory: serializable,
  } as const;
  return {
    ...body,
    digest: remember({
      ...body,
      digest: assetRefFor({ ...body, digest: R188_ZERO_DIGEST }),
    }),
  };
};

export const surfaceAssetFor = (surface: RevealSurface) => {
  const body = {
    artifact: PREFLIGHT_REVEAL_SURFACE,
    version: PREFLIGHT_REVEAL_CONTINUATION_VERSION,
    surface,
  } as const;
  return {
    ...body,
    digest: remember({
      ...body,
      digest: assetRefFor({ ...body, digest: R188_ZERO_DIGEST }),
    }),
  };
};

const pathNodeForStep = (input: {
  readonly step: RevealPath["steps"][number];
  readonly index: number;
  readonly parentPathDigest: string | null;
}): RevealPathNode => {
  const before = surfaceAssetFor(input.step.before);
  const after = surfaceAssetFor(input.step.after);
  const {
    before: _before,
    after: _after,
    beforeUrl: _beforeUrl,
    afterUrl: _afterUrl,
    nonMutation: _nonMutation,
    representativeInput: _representativeInput,
    ...action
  } = input.step;
  const body = {
    artifact: PREFLIGHT_REVEAL_PATH_NODE,
    version: PREFLIGHT_REVEAL_CONTINUATION_VERSION,
    parentPathDigest: input.parentPathDigest,
    depth: input.index + 1,
    step: {
      controlKey: input.step.controlKey,
      action,
      representativeInput: input.step.representativeInput ?? null,
      beforeSurfaceDigest: before.digest,
      afterSurfaceDigest: after.digest,
      beforeUrl: input.step.beforeUrl,
      afterUrl: input.step.afterUrl,
      nonMutation: input.step.nonMutation,
    },
    url: input.step.afterUrl,
    surfaceRef: after.digest,
    surfaceDigest: after.digest,
  } as const;
  const digest = remember({
    ...body,
    digest: assetRefFor({ ...body, digest: R188_ZERO_DIGEST }),
  });
  return { ...body, digest };
};

const rootPathNodeFor = (
  path: RevealPath,
  surface: RevealSurface,
): RevealPathNode => {
  const asset = surfaceAssetFor(surface);
  const body = {
    artifact: PREFLIGHT_REVEAL_PATH_NODE,
    version: PREFLIGHT_REVEAL_CONTINUATION_VERSION,
    parentPathDigest: null,
    depth: 0,
    step: null,
    url: path.initialUrl,
    surfaceRef: asset.digest,
    surfaceDigest: asset.digest,
  } as const;
  const digest = remember({
    ...body,
    digest: assetRefFor({ ...body, digest: R188_ZERO_DIGEST }),
  });
  return { ...body, digest };
};

export const pathNodeAssetsFor = (
  path: RevealPath,
  initialSurface: RevealSurface,
): { readonly node: RevealPathNode; readonly digest: string } => {
  const root = rootPathNodeFor(path, path.steps[0]?.before ?? initialSurface);
  const nodes: RevealPathNode[] = [root];
  for (const [index, step] of path.steps.entries())
    nodes.push(
      pathNodeForStep({
        step,
        index,
        parentPathDigest: nodes.at(-1)?.digest ?? null,
      }),
    );
  const node = nodes.at(-1);
  if (node === undefined) throw new Error("Path node is missing");
  return { node, digest: node.digest };
};

export const branchAssetFor = (branch: RevealBranch): RevealBranchAsset => {
  const inventory = inventoryAssetFor(branch.inventory);
  const surface = surfaceAssetFor(branch.surface);
  const pathNode = pathNodeAssetsFor(branch.path, branch.surface);
  const body = {
    artifact: PREFLIGHT_REVEAL_BRANCH,
    version: PREFLIGHT_REVEAL_CONTINUATION_VERSION,
    pathNodeRef: pathNode.node.digest,
    pathDigest: branch.path.digest,
    inventoryRef: inventory.digest,
    inventoryDigest: inventory.digest,
    surfaceRef: surface.digest,
    surfaceDigest: branch.surface.digest,
    url: canonicalRevealUrlFor(branch.url),
    depth: branch.path.steps.length,
  } as const;
  const digest = remember({
    ...body,
    digest: assetRefFor({ ...body, digest: R188_ZERO_DIGEST }),
  });
  return freezeDeep({ ...body, digest });
};

export const candidateListAssetFor = (
  branch: RevealBranch,
  candidates: readonly RevealCandidate[],
  branchDigest: string,
): RevealCandidateList => {
  const ids = revealCandidateIdsFor(branch, candidates);
  const body = {
    artifact: PREFLIGHT_REVEAL_CANDIDATE_LIST,
    version: PREFLIGHT_REVEAL_CONTINUATION_VERSION,
    branchDigest,
    candidates: candidates.map((candidate, index) => ({
      candidateId: ids[index] ?? R188_ZERO_DIGEST,
      action: candidate.action,
      representativeInput: candidate.representativeInput ?? null,
    })),
  } as const;
  const digest = remember({
    ...body,
    digest: assetRefFor({ ...body, digest: R188_ZERO_DIGEST }),
  });
  return candidateListSchema.parse({ ...body, digest });
};

export const candidateFrontierFor = (input: {
  readonly branch: RevealBranch;
  readonly candidates: readonly RevealCandidate[];
}) => {
  const branch = branchAssetFor(input.branch);
  const candidates = candidateListAssetFor(
    input.branch,
    input.candidates,
    branch.digest,
  );
  return {
    branchRef: branch.digest,
    branchDigest: branch.digest,
    candidateListRef: candidates.digest,
    candidateListDigest: candidateListDigestFor(
      candidates.candidates.map((candidate) => candidate.candidateId),
    ),
  };
};
