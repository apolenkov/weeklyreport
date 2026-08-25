import { ZodError } from "zod";

import { stableSerialize } from "../../../support/ids.ts";
import type { CapacitySurveyPlan } from "../../capacity/preflight-capacity-survey-contract.ts";
import {
  assertPreflightArchivePath,
  ensurePreflightArchiveRoot,
} from "../../preflight-archive-path.ts";
import type { RevealCandidateList } from "../continuation/contracts/preflight-reveal-continuation-schemas.ts";
import {
  readRevealContinuationAsset,
  rememberRevealContinuationAsset,
  type RevealContinuationAsset,
} from "../continuation/preflight-reveal-continuation-assets.ts";
import { RevealContinuationError } from "../continuation/preflight-reveal-continuation-errors.ts";
import {
  assetsForCandidateFrontier,
  branchForRef,
} from "../continuation/receipts/preflight-reveal-continuation-receipt-refs.ts";
import {
  assertFailureFrontierBindings,
  assertFailureFrontierClosure,
  requiredFailureFrontierBranch,
  requiredFailureFrontierCandidates,
} from "./preflight-reveal-failure-frontier-content.ts";
import {
  assertFailureFrontierMatchesPlan,
  parseRevealFailureFrontierManifest,
  RevealFailureFrontierError,
  type RevealFailureFrontierManifest,
} from "./preflight-reveal-failure-frontier-contract.ts";
import { assertFailureFrontierPendingBranchBinding } from "./preflight-reveal-failure-frontier-pending-branch.ts";
import {
  failureFrontierManifestPathFor,
  failureFrontierManifestTextFor,
  readFailureFrontierManifestText,
} from "./preflight-reveal-failure-frontier-publication.ts";

export {
  assertFailureFrontierManifestAbsent,
  captureRevealFailureFrontier,
} from "./preflight-reveal-failure-frontier-publication.ts";

const readBackPackets = new WeakSet<object>();

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch (error: unknown) {
    throw new RevealFailureFrontierError(
      `Cannot parse failure-frontier manifest: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const parseManifestText = (text: string): RevealFailureFrontierManifest => {
  if (!text.endsWith("\n"))
    throw new RevealFailureFrontierError(
      "Failure-frontier manifest bytes are not canonical",
    );
  const manifest = parseRevealFailureFrontierManifest(parseJson(text));
  if (text !== failureFrontierManifestTextFor(manifest))
    throw new RevealFailureFrontierError(
      "Failure-frontier manifest bytes are not canonical",
    );
  return manifest;
};

const loadAssets = async (input: {
  readonly packetRoot: string;
  readonly manifest: RevealFailureFrontierManifest;
}): Promise<readonly RevealContinuationAsset[]> => {
  const assets: RevealContinuationAsset[] = [];
  for (const descriptor of input.manifest.assets) {
    const asset = await readRevealContinuationAsset({
      archiveRoot: input.packetRoot,
      artifact: descriptor.artifact,
      ref: descriptor.ref,
    });
    const bytes = Buffer.byteLength(`${stableSerialize(asset)}\n`, "utf8");
    if (bytes !== descriptor.bytes)
      throw new RevealFailureFrontierError(
        "Failure-frontier asset size does not match its manifest",
      );
    rememberRevealContinuationAsset(asset);
    assets.push(asset);
  }
  return assets;
};

export type RevealFailureFrontierPacket = Readonly<{
  readonly manifest: RevealFailureFrontierManifest;
  readonly branch: ReturnType<typeof branchForRef>;
  readonly pendingBranch?: ReturnType<typeof branchForRef> | undefined;
  readonly candidates: RevealCandidateList["candidates"];
}>;

export const assertRevealFailureFrontierPacketReadBack = (
  packet: RevealFailureFrontierPacket,
): void => {
  if (!readBackPackets.has(packet))
    throw new RevealFailureFrontierError(
      "Failure-frontier packet must come from archive read-back",
    );
};

const missingPacketFile = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

const invalidPacketContent = (error: unknown): boolean =>
  missingPacketFile(error) ||
  error instanceof RevealContinuationError ||
  error instanceof ZodError;

const readValidatedFailureFrontierPacket = async (input: {
  readonly packetRoot: string;
  readonly expectedPlan: CapacitySurveyPlan;
}): Promise<RevealFailureFrontierPacket> => {
  const packetRoot = await ensurePreflightArchiveRoot(input.packetRoot);
  const manifestPath = failureFrontierManifestPathFor(packetRoot);
  await assertPreflightArchivePath(packetRoot, manifestPath);
  const manifest = parseManifestText(
    await readFailureFrontierManifestText(manifestPath),
  );
  assertFailureFrontierMatchesPlan(manifest, input.expectedPlan);
  await loadAssets({ packetRoot, manifest });
  const branchAsset = requiredFailureFrontierBranch(manifest.branchRef);
  const pendingBranchAsset =
    manifest.pendingBranchRef === undefined
      ? undefined
      : requiredFailureFrontierBranch(manifest.pendingBranchRef);
  const candidateList = requiredFailureFrontierCandidates(
    manifest.candidateListRef,
  );
  const closure = assetsForCandidateFrontier({
    branchRef: manifest.branchRef,
    candidateListRef: manifest.candidateListRef,
    ...(pendingBranchAsset === undefined
      ? {}
      : { additionalBranchRefs: [pendingBranchAsset.digest] }),
  });
  assertFailureFrontierClosure(manifest, closure);
  assertFailureFrontierBindings({
    manifest,
    branch: branchAsset,
    ...(pendingBranchAsset === undefined
      ? {}
      : { pendingBranch: pendingBranchAsset }),
    candidates: candidateList,
  });
  const branch = branchForRef(manifest.branchRef);
  const pendingBranch =
    pendingBranchAsset === undefined
      ? undefined
      : branchForRef(pendingBranchAsset.digest);
  if (pendingBranch !== undefined) {
    const candidate = candidateList.candidates[manifest.candidateIndex];
    if (candidate === undefined)
      throw new RevealFailureFrontierError(
        "Failure-frontier candidate is unavailable for pending-branch binding",
      );
    assertFailureFrontierPendingBranchBinding({
      branch,
      pendingBranch,
      candidate,
    });
  }
  const packet = {
    manifest,
    branch,
    candidates: candidateList.candidates,
    ...(pendingBranch === undefined ? {} : { pendingBranch }),
  };
  readBackPackets.add(packet);
  return packet;
};

export const readRevealFailureFrontierPacket = async (input: {
  readonly packetRoot: string;
  readonly expectedPlan: CapacitySurveyPlan;
}): Promise<RevealFailureFrontierPacket> => {
  try {
    return await readValidatedFailureFrontierPacket(input);
  } catch (error: unknown) {
    if (error instanceof RevealFailureFrontierError) throw error;
    if (!invalidPacketContent(error)) throw error;
    throw new RevealFailureFrontierError(
      `Failure-frontier packet is incomplete or invalid: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
};
