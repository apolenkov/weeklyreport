import { lstat, readFile, realpath } from "node:fs/promises";
import * as path from "node:path";

import { writeManifestFile } from "../../../source/manifest-source.ts";
import { stableSerialize } from "../../../support/ids.ts";
import {
  assertPreflightArchivePath,
  assertPreflightRegularFile,
  ensurePreflightArchiveRoot,
  PreflightArchivePathError,
} from "../../preflight-archive-path.ts";
import {
  type PreflightShardResourceProof,
  PreflightShardResourceProofError,
} from "./preflight-shard-resource-proof-contract.ts";
import {
  assertPreflightShardResourceProofFilesystem,
  parsePreflightShardResourceProof,
} from "./preflight-shard-resource-proof-validation.ts";

export const serializePreflightShardResourceProof = (
  proof: PreflightShardResourceProof,
): string => `${stableSerialize(parsePreflightShardResourceProof(proof))}\n`;

const assertRegularImmutableFile = async (filePath: string): Promise<void> => {
  const stat = await lstat(filePath).catch((error: unknown) => {
    throw new PreflightShardResourceProofError(
      `Resource proof file is unavailable: ${error instanceof Error ? error.message : filePath}`,
    );
  });
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new PreflightShardResourceProofError(
      `Resource proof file must be a regular non-symlink file: ${filePath}`,
    );
  if ((await realpath(filePath)) !== path.resolve(filePath))
    throw new PreflightShardResourceProofError(
      `Resource proof file must not traverse a symlink: ${filePath}`,
    );
};

export async function readPreflightShardResourceProof(
  filePath: string,
  archiveRoot: string,
): Promise<PreflightShardResourceProof> {
  try {
    // Proof files are required beneath the archive root; the root itself is
    // intentionally not a valid file location.
    await assertPreflightArchivePath(archiveRoot, filePath);
    await assertRegularImmutableFile(filePath);
    const text = await readFile(filePath, "utf8");
    const proof = parsePreflightShardResourceProof(JSON.parse(text) as unknown);
    if (proof.resources.archiveRoot !== archiveRoot)
      throw new PreflightShardResourceProofError(
        "Resource proof archive root does not match the supplied read root",
      );
    if (text !== serializePreflightShardResourceProof(proof))
      throw new PreflightShardResourceProofError(
        "PREFLIGHT_SHARD_RESOURCE_PROOF bytes are not canonical",
      );
    return proof;
  } catch (error: unknown) {
    if (
      error instanceof PreflightShardResourceProofError ||
      error instanceof PreflightArchivePathError
    )
      throw error;
    throw new PreflightShardResourceProofError(
      `Cannot read PREFLIGHT_SHARD_RESOURCE_PROOF.json: ${error instanceof Error ? error.message : "invalid JSON"}`,
    );
  }
}

export async function writePreflightShardResourceProof(input: {
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly proof: PreflightShardResourceProof;
}): Promise<void> {
  const proof = parsePreflightShardResourceProof(input.proof);
  if (proof.resources.archiveRoot !== input.archiveRoot)
    throw new PreflightShardResourceProofError(
      "Resource proof archive root does not match the write root",
    );
  await assertPreflightShardResourceProofFilesystem(proof);
  const archiveRoot = await ensurePreflightArchiveRoot(input.archiveRoot);
  await assertPreflightArchivePath(archiveRoot, input.filePath);
  await writeManifestFile(
    input.filePath,
    serializePreflightShardResourceProof(proof),
  );
  await assertPreflightRegularFile(input.filePath);
  await readPreflightShardResourceProof(input.filePath, archiveRoot);
}
