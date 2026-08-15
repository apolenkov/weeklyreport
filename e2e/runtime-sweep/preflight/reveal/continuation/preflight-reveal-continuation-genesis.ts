import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import { canonicalRevealUrlFor } from "../../reveal-path.ts";
import { candidatesForImmediateReveal } from "../guards/preflight-reveal-registration.ts";
import type {
  RevealDiscoveryState,
  RevealQueueInput,
} from "../interaction/preflight-reveal-branches.ts";
import type { RevealExecutionGrant } from "./preflight-reveal-continuation-schemas.ts";
import {
  branchAssetFor,
  candidateListAssetFor,
  candidateListDigestFor,
  inventoryAssetFor,
  pathNodeAssetsFor,
  surfaceAssetFor,
} from "./receipts/preflight-reveal-continuation-receipt-assets.ts";

type RevealGenesis = RevealExecutionGrant["genesis"];

const GENESIS_FIELDS = [
  "inventoryRef",
  "inventoryDigest",
  "surfaceRef",
  "surfaceDigest",
  "pathNodeRef",
  "pathDigest",
  "branchRef",
  "branchDigest",
  "candidateListRef",
  "candidateListDigest",
  "url",
] as const satisfies readonly (keyof RevealGenesis)[];

const diagnosticValueFor = (
  field: keyof RevealGenesis,
  value: string,
): string =>
  field === "url" ? `sha256:${sha256Hex(value)};length=${value.length}` : value;

export const genesisMismatchFor = (
  fresh: RevealGenesis,
  sealed: RevealGenesis,
): string =>
  GENESIS_FIELDS.filter((field) => fresh[field] !== sealed[field])
    .map(
      (field) =>
        `${field}[sealed=${diagnosticValueFor(field, sealed[field])},fresh=${diagnosticValueFor(field, fresh[field])}]`,
    )
    .join(", ");

export const genesisForState = (input: {
  readonly state: RevealDiscoveryState;
  readonly candidatesFor: RevealQueueInput["candidatesFor"];
}): RevealExecutionGrant["genesis"] => {
  const initialBranch = input.state.queue[0];
  if (initialBranch === undefined)
    throw new Error("R188 parent reducer has no genesis branch");
  const candidates = candidatesForImmediateReveal(
    { candidatesFor: input.candidatesFor },
    initialBranch,
  );
  const branch = branchAssetFor(initialBranch);
  const candidatesAsset = candidateListAssetFor(
    initialBranch,
    candidates,
    branch.digest,
  );
  const inventory = inventoryAssetFor(initialBranch.inventory);
  const surface = surfaceAssetFor(initialBranch.surface);
  const pathNode = pathNodeAssetsFor(initialBranch.path, initialBranch.surface);
  return {
    inventoryRef: inventory.digest,
    inventoryDigest: inventory.digest,
    surfaceRef: surface.digest,
    surfaceDigest: surface.digest,
    pathNodeRef: pathNode.node.digest,
    pathDigest: initialBranch.path.digest,
    branchRef: branch.digest,
    branchDigest: branch.digest,
    candidateListRef: candidatesAsset.digest,
    candidateListDigest: candidateListDigestFor(
      candidatesAsset.candidates.map((candidate) => candidate.candidateId),
    ),
    url: canonicalRevealUrlFor(initialBranch.url),
  };
};

export const assertFreshGenesis = (input: {
  readonly state: RevealDiscoveryState;
  readonly candidatesFor: RevealQueueInput["candidatesFor"];
  readonly grant: RevealExecutionGrant;
}): void => {
  const fresh = genesisForState(input);
  if (stableSerialize(fresh) !== stableSerialize(input.grant.genesis)) {
    const mismatch = genesisMismatchFor(fresh, input.grant.genesis);
    throw new Error(
      `R188 fresh genesis does not match the parent-sealed grant: ${mismatch || "canonical serialization drift"}`,
    );
  }
};
