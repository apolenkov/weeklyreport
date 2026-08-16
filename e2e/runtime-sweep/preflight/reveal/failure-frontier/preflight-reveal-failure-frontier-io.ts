import { lstat, open, unlink } from "node:fs/promises";
import * as path from "node:path";

import { ZodError } from "zod";

import { stableSerialize } from "../../../support/ids.ts";
import type { CapacitySurveyPlan } from "../../capacity/preflight-capacity-survey-contract.ts";
import {
  assertPreflightArchivePath,
  ensurePreflightArchiveRoot,
} from "../../preflight-archive-path.ts";
import { readBoundedRegularFile } from "../continuation/io/preflight-reveal-continuation-bounded-file.ts";
import {
  readRevealContinuationAsset,
  rememberRevealContinuationAsset,
  type RevealContinuationAsset,
  writeRevealContinuationAsset,
} from "../continuation/preflight-reveal-continuation-assets.ts";
import { RevealContinuationError } from "../continuation/preflight-reveal-continuation-errors.ts";
import type { RevealCandidateList } from "../continuation/preflight-reveal-continuation-schemas.ts";
import { candidateFrontierFor } from "../continuation/receipts/preflight-reveal-continuation-receipt-assets.ts";
import {
  assetsForCandidateFrontier,
  branchForRef,
} from "../continuation/receipts/preflight-reveal-continuation-receipt-refs.ts";
import type { RevealCandidateFailure } from "../interaction/preflight-reveal-branches.ts";
import {
  assertFailureFrontierBindings,
  assertFailureFrontierClosure,
  canonicalFailureFrontierAssets,
  failureFrontierManifestFor,
  requiredFailureFrontierBranch,
  requiredFailureFrontierCandidates,
} from "./preflight-reveal-failure-frontier-content.ts";
import {
  assertFailureFrontierMatchesPlan,
  FAILURE_FRONTIER_LIMITS,
  FAILURE_FRONTIER_MANIFEST_NAME,
  parseRevealFailureFrontierManifest,
  RevealFailureFrontierError,
  type RevealFailureFrontierManifest,
} from "./preflight-reveal-failure-frontier-contract.ts";

const PRIVATE_FILE_MODE = 0o600;
const manifestPathFor = (packetRoot: string): string =>
  path.join(packetRoot, FAILURE_FRONTIER_MANIFEST_NAME);

export const assertFailureFrontierManifestAbsent = async (
  packetRoot: string,
): Promise<void> => {
  const exactRoot = await ensurePreflightArchiveRoot(packetRoot);
  const manifestPath = manifestPathFor(exactRoot);
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

const manifestTextFor = (manifest: RevealFailureFrontierManifest): string => {
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

const readManifestText = async (manifestPath: string): Promise<string> =>
  (
    await readBoundedRegularFile({
      filePath: manifestPath,
      maxBytes: FAILURE_FRONTIER_LIMITS.maxManifestBytes,
      regularFileError:
        "Failure-frontier manifest must be a regular non-symlink file",
      sizeError: "Failure-frontier manifest exceeds the byte bound",
    })
  ).toString("utf8");

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
  if (text !== manifestTextFor(manifest))
    throw new RevealFailureFrontierError(
      "Failure-frontier manifest bytes are not canonical",
    );
  return manifest;
};

const writeManifestLast = async (input: {
  readonly packetRoot: string;
  readonly manifest: RevealFailureFrontierManifest;
}): Promise<void> => {
  const manifestPath = manifestPathFor(input.packetRoot);
  await assertPreflightArchivePath(input.packetRoot, manifestPath);
  const text = manifestTextFor(input.manifest);
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
    if ((await readManifestText(manifestPath)) !== text)
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
  const assets = assetsForCandidateFrontier(frontier);
  const manifest = failureFrontierManifestFor({
    plan: input.plan,
    failure: input.failure,
    branch,
    candidates,
    assets,
  });
  manifestTextFor(manifest);
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
  readonly candidates: RevealCandidateList["candidates"];
}>;

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
  const manifestPath = manifestPathFor(packetRoot);
  await assertPreflightArchivePath(packetRoot, manifestPath);
  const manifest = parseManifestText(await readManifestText(manifestPath));
  assertFailureFrontierMatchesPlan(manifest, input.expectedPlan);
  await loadAssets({ packetRoot, manifest });
  const branchAsset = requiredFailureFrontierBranch(manifest.branchRef);
  const candidateList = requiredFailureFrontierCandidates(
    manifest.candidateListRef,
  );
  const closure = assetsForCandidateFrontier({
    branchRef: manifest.branchRef,
    candidateListRef: manifest.candidateListRef,
  });
  assertFailureFrontierClosure(manifest, closure);
  assertFailureFrontierBindings({
    manifest,
    branch: branchAsset,
    candidates: candidateList,
  });
  return {
    manifest,
    branch: branchForRef(manifest.branchRef),
    candidates: candidateList.candidates,
  };
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
