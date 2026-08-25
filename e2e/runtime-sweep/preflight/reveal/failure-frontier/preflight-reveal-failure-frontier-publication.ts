import { lstat, open, unlink } from "node:fs/promises";
import * as path from "node:path";

import { stableSerialize } from "../../../support/ids.ts";
import type { CapacitySurveyPlan } from "../../capacity/preflight-capacity-survey-contract.ts";
import {
  assertPreflightArchivePath,
  ensurePreflightArchiveRoot,
} from "../../preflight-archive-path.ts";
import { readBoundedRegularFile } from "../continuation/io/preflight-reveal-continuation-bounded-file.ts";
import {
  readRevealContinuationAsset,
  writeRevealContinuationAsset,
} from "../continuation/preflight-reveal-continuation-assets.ts";
import {
  branchAssetFor,
  candidateFrontierFor,
} from "../continuation/receipts/preflight-reveal-continuation-receipt-assets.ts";
import { assetsForCandidateFrontier } from "../continuation/receipts/preflight-reveal-continuation-receipt-refs.ts";
import type { RevealCandidateFailure } from "../interaction/preflight-reveal-branches.ts";
import {
  canonicalFailureFrontierAssets,
  failureFrontierManifestFor,
  requiredFailureFrontierBranch,
  requiredFailureFrontierCandidates,
} from "./preflight-reveal-failure-frontier-content.ts";
import {
  FAILURE_FRONTIER_LIMITS,
  FAILURE_FRONTIER_MANIFEST_NAME,
  RevealFailureFrontierError,
  type RevealFailureFrontierManifest,
} from "./preflight-reveal-failure-frontier-contract.ts";

const PRIVATE_FILE_MODE = 0o600;

export const failureFrontierManifestPathFor = (packetRoot: string): string =>
  path.join(packetRoot, FAILURE_FRONTIER_MANIFEST_NAME);

export const failureFrontierManifestTextFor = (
  manifest: RevealFailureFrontierManifest,
): string => {
  const text = `${stableSerialize(manifest)}\n`;
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > FAILURE_FRONTIER_LIMITS.maxManifestBytes)
    throw new RevealFailureFrontierError(
      "Failure-frontier manifest exceeds the byte bound",
    );
  const aggregate =
    bytes + manifest.assets.reduce((total, asset) => total + asset.bytes, 0);
  if (aggregate > FAILURE_FRONTIER_LIMITS.maxAggregateBytes)
    throw new RevealFailureFrontierError(
      "Failure-frontier packet exceeds the aggregate byte bound",
    );
  return text;
};

export const readFailureFrontierManifestText = async (
  manifestPath: string,
): Promise<string> =>
  (
    await readBoundedRegularFile({
      filePath: manifestPath,
      maxBytes: FAILURE_FRONTIER_LIMITS.maxManifestBytes,
      regularFileError:
        "Failure-frontier manifest must be a regular non-symlink file",
      sizeError: "Failure-frontier manifest exceeds the byte bound",
    })
  ).toString("utf8");

export const assertFailureFrontierManifestAbsent = async (
  packetRoot: string,
): Promise<void> => {
  const exactRoot = await ensurePreflightArchiveRoot(packetRoot);
  const manifestPath = failureFrontierManifestPathFor(exactRoot);
  await assertPreflightArchivePath(exactRoot, manifestPath);
  try {
    await lstat(manifestPath);
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return;
    throw error;
  }
  throw new RevealFailureFrontierError(
    `Failure-frontier manifest already exists: ${manifestPath}`,
  );
};

const writeManifestLast = async (input: {
  readonly packetRoot: string;
  readonly manifest: RevealFailureFrontierManifest;
}): Promise<void> => {
  const manifestPath = failureFrontierManifestPathFor(input.packetRoot);
  await assertPreflightArchivePath(input.packetRoot, manifestPath);
  const text = failureFrontierManifestTextFor(input.manifest);
  const handle = await open(manifestPath, "wx", PRIVATE_FILE_MODE).catch(
    (error: unknown) => {
      throw new RevealFailureFrontierError(
        `Cannot publish failure-frontier manifest: ${error instanceof Error ? error.message : String(error)}`,
      );
    },
  );
  try {
    try {
      await handle.writeFile(text, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    if ((await readFailureFrontierManifestText(manifestPath)) !== text)
      throw new RevealFailureFrontierError(
        "Failure-frontier manifest changed during publication",
      );
  } catch (error: unknown) {
    await unlink(manifestPath).catch(() => undefined);
    if (error instanceof RevealFailureFrontierError) throw error;
    throw new RevealFailureFrontierError(
      `Cannot publish failure-frontier manifest: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const captureRevealFailureFrontier = async (input: {
  readonly packetRoot: string;
  readonly plan: CapacitySurveyPlan;
  readonly failure: RevealCandidateFailure;
}): Promise<void> => {
  const packetRoot = await ensurePreflightArchiveRoot(input.packetRoot);
  await assertFailureFrontierManifestAbsent(packetRoot);
  const frontier = candidateFrontierFor({
    branch: input.failure.branch,
    candidates: input.failure.candidates,
  });
  const branch = requiredFailureFrontierBranch(frontier.branchRef);
  const candidates = requiredFailureFrontierCandidates(
    frontier.candidateListRef,
  );
  const pendingBranch =
    input.failure.pendingBranch === undefined
      ? undefined
      : branchAssetFor(input.failure.pendingBranch);
  const assets = assetsForCandidateFrontier({
    ...frontier,
    ...(pendingBranch === undefined
      ? {}
      : { additionalBranchRefs: [pendingBranch.digest] }),
  });
  const manifest = failureFrontierManifestFor({
    plan: input.plan,
    failure: input.failure,
    branch,
    ...(pendingBranch === undefined ? {} : { pendingBranch }),
    candidates,
    assets,
  });
  failureFrontierManifestTextFor(manifest);
  for (const asset of canonicalFailureFrontierAssets(assets)) {
    await writeRevealContinuationAsset({ archiveRoot: packetRoot, asset });
    const readBack = await readRevealContinuationAsset({
      archiveRoot: packetRoot,
      artifact: asset.artifact,
      ref: asset.digest,
    });
    if (stableSerialize(readBack) !== stableSerialize(asset))
      throw new RevealFailureFrontierError(
        "Failure-frontier asset changed during publication",
      );
  }
  await writeManifestLast({ packetRoot, manifest });
};
