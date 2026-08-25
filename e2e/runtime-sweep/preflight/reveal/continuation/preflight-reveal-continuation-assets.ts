import { link, lstat, open, unlink } from "node:fs/promises";
import * as path from "node:path";

import { freezeDeep } from "../../../source/manifest-source.ts";
import { stableSerialize } from "../../../support/ids.ts";
import {
  assertPreflightArchivePath,
  ensurePreflightArchiveDirectory,
} from "../../preflight-archive-path.ts";
import {
  branchSchema,
  candidateListSchema,
  controlAssetSchema,
  inventoryAssetSchema,
  pathNodeSchema,
  PREFLIGHT_REVEAL_BRANCH,
  PREFLIGHT_REVEAL_CANDIDATE_LIST,
  PREFLIGHT_REVEAL_CONTROL,
  PREFLIGHT_REVEAL_INVENTORY,
  PREFLIGHT_REVEAL_PATH_NODE,
  PREFLIGHT_REVEAL_REDUCER_CHECKPOINT,
  PREFLIGHT_REVEAL_SURFACE,
  reducerCheckpointSchema,
  type RevealBranchAsset,
  type RevealCandidateList,
  type RevealControlAsset,
  type RevealInventoryAsset,
  type RevealPathNode,
  type RevealReducerCheckpoint,
  type RevealSurfaceAsset,
  surfaceAssetSchema,
} from "./contracts/preflight-reveal-continuation-schemas.ts";
import { readBoundedRegularFile } from "./io/preflight-reveal-continuation-bounded-file.ts";
import {
  contentDigestFor,
  R188_DIGEST_LENGTH,
} from "./preflight-reveal-continuation-digests.ts";
import { RevealContinuationError } from "./preflight-reveal-continuation-errors.ts";

const REF_PATTERN = new RegExp(
  `^[0-9a-f]{${String(R188_DIGEST_LENGTH)}}$`,
  "u",
);
export const MAX_ASSET_BYTES = 8_388_608;
const PRIVATE_FILE_MODE = 0o600;
const CONTENT_ASSET_SIZE_ERROR = "Content asset exceeds the byte bound";
const CONTENT_ASSET_REGULAR_FILE_ERROR =
  "Content asset must be a regular non-symlink file";
const temporaryCounter = { value: 0 };

export type RevealContinuationAsset =
  | RevealInventoryAsset
  | RevealSurfaceAsset
  | RevealPathNode
  | RevealCandidateList
  | RevealBranchAsset
  | RevealControlAsset
  | RevealReducerCheckpoint;

const memoryAssets = new Map<string, RevealContinuationAsset>();

/**
 * The parent reducer may receive assets from the child in the same process.
 * Durable callers must still write/read the archive files; this registry is
 * only a bounded in-process transport and is never trusted for digest checks.
 */
export const rememberRevealContinuationAsset = (
  asset: RevealContinuationAsset,
): string => {
  const parsed = parseAsset(asset.artifact, asset);
  memoryAssets.set(`${parsed.artifact}:${parsed.digest}`, parsed);
  return parsed.digest;
};

export const rememberedRevealContinuationAsset = (input: {
  readonly artifact: RevealContinuationAsset["artifact"];
  readonly ref: string;
}): RevealContinuationAsset | undefined =>
  memoryAssets.get(`${input.artifact}:${input.ref}`);

const assetDirectoryFor = (
  root: string,
  artifact: RevealContinuationAsset["artifact"],
): string => path.join(root, "continuation", "assets", artifact.toLowerCase());

const bodyFor = (asset: RevealContinuationAsset): Record<string, unknown> => {
  const { digest: _digest, ...body } = asset;
  return body;
};

export const assetRefFor = (asset: RevealContinuationAsset): string =>
  contentDigestFor(asset.artifact, bodyFor(asset));

const assertAssetRef = (ref: string): void => {
  if (!REF_PATTERN.test(ref))
    throw new RevealContinuationError(
      "Content asset ref must be a lowercase SHA-256 digest",
    );
};

const assetPathFor = (
  archiveRoot: string,
  artifact: RevealContinuationAsset["artifact"],
  ref: string,
): string => {
  assertAssetRef(ref);
  const root = path.resolve(archiveRoot);
  const filePath = path.join(assetDirectoryFor(root, artifact), `${ref}.json`);
  const relative = path.relative(root, filePath);
  if (
    relative === "" ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative) ||
    path.basename(filePath) !== `${ref}.json`
  )
    throw new RevealContinuationError(
      "Content asset path escapes the archive root",
    );
  return filePath;
};

const schemaFor = (artifact: RevealContinuationAsset["artifact"]) => {
  switch (artifact) {
    case PREFLIGHT_REVEAL_INVENTORY:
      return inventoryAssetSchema;
    case PREFLIGHT_REVEAL_SURFACE:
      return surfaceAssetSchema;
    case PREFLIGHT_REVEAL_PATH_NODE:
      return pathNodeSchema;
    case PREFLIGHT_REVEAL_CANDIDATE_LIST:
      return candidateListSchema;
    case PREFLIGHT_REVEAL_BRANCH:
      return branchSchema;
    case PREFLIGHT_REVEAL_CONTROL:
      return controlAssetSchema;
    case PREFLIGHT_REVEAL_REDUCER_CHECKPOINT:
      return reducerCheckpointSchema;
  }
};

const parseAsset = (
  artifact: RevealContinuationAsset["artifact"],
  value: unknown,
): RevealContinuationAsset => {
  const parsed = schemaFor(artifact).parse(value);
  if (assetRefFor(parsed) !== parsed.digest)
    throw new RevealContinuationError(
      "Content asset digest does not match canonical contents",
    );
  return freezeDeep(parsed);
};

const linkOrVerifyAsset = async (input: {
  readonly temporaryPath: string;
  readonly filePath: string;
  readonly text: string;
}): Promise<void> => {
  try {
    await link(input.temporaryPath, input.filePath);
    await unlink(input.temporaryPath);
  } catch (error: unknown) {
    const isExisting =
      error instanceof Error && "code" in error && error.code === "EEXIST";
    if (!isExisting) throw error;
    const existing = (
      await readBoundedRegularFile({
        filePath: input.filePath,
        maxBytes: MAX_ASSET_BYTES,
        regularFileError: CONTENT_ASSET_REGULAR_FILE_ERROR,
        sizeError: CONTENT_ASSET_SIZE_ERROR,
      })
    ).toString("utf8");
    if (existing !== input.text)
      throw new RevealContinuationError(
        "Conflicting immutable content asset bytes already exist",
      );
    await unlink(input.temporaryPath);
  }
};

const writeTemporaryAsset = async (input: {
  readonly temporaryPath: string;
  readonly text: string;
}): Promise<void> => {
  const handle = await open(input.temporaryPath, "wx", PRIVATE_FILE_MODE);
  try {
    await handle.writeFile(input.text, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
};

export const writeRevealContinuationAsset = async (input: {
  readonly archiveRoot: string;
  readonly asset: RevealContinuationAsset;
}): Promise<string> => {
  const parsed = parseAsset(input.asset.artifact, input.asset);
  const ref = parsed.digest;
  const filePath = assetPathFor(input.archiveRoot, parsed.artifact, ref);
  const directory = path.dirname(filePath);
  await ensurePreflightArchiveDirectory(
    path.resolve(input.archiveRoot),
    directory,
  );
  await assertPreflightArchivePath(path.resolve(input.archiveRoot), filePath);
  const text = `${stableSerialize(parsed)}\n`;
  if (Buffer.byteLength(text, "utf8") > MAX_ASSET_BYTES)
    throw new RevealContinuationError(CONTENT_ASSET_SIZE_ERROR);
  temporaryCounter.value += 1;
  const temporaryPath = path.join(
    directory,
    `.${ref}.${process.pid}.${String(temporaryCounter.value)}.tmp`,
  );
  await assertPreflightArchivePath(
    path.resolve(input.archiveRoot),
    temporaryPath,
  );
  try {
    await writeTemporaryAsset({ temporaryPath, text });
    await linkOrVerifyAsset({ temporaryPath, filePath, text });
  } catch (error: unknown) {
    await unlink(temporaryPath).catch(() => undefined);
    if (error instanceof RevealContinuationError) throw error;
    throw new RevealContinuationError(
      `Cannot write immutable content asset: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return ref;
};

export const readRevealContinuationAsset = async (input: {
  readonly archiveRoot: string;
  readonly artifact: RevealContinuationAsset["artifact"];
  readonly ref: string;
}): Promise<RevealContinuationAsset> => {
  const filePath = assetPathFor(input.archiveRoot, input.artifact, input.ref);
  await assertPreflightArchivePath(path.resolve(input.archiveRoot), filePath);
  const buffer = await readBoundedRegularFile({
    filePath,
    maxBytes: MAX_ASSET_BYTES,
    regularFileError: CONTENT_ASSET_REGULAR_FILE_ERROR,
    sizeError: CONTENT_ASSET_SIZE_ERROR,
  });
  const text = buffer.toString("utf8");
  if (text.length === 0 || !text.endsWith("\n"))
    throw new RevealContinuationError("Content asset bytes are not canonical");
  const value = (() => {
    try {
      const parsed: unknown = JSON.parse(text);
      return parsed;
    } catch (error: unknown) {
      throw new RevealContinuationError(
        `Content asset JSON is invalid: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  })();
  const parsed = parseAsset(input.artifact, value);
  if (stableSerialize(parsed) !== text.slice(0, -1))
    throw new RevealContinuationError("Content asset bytes are not canonical");
  if (parsed.digest !== input.ref)
    throw new RevealContinuationError(
      "Content asset filename does not match its digest",
    );
  return parsed;
};

/**
 * Re-checks the durable boundary without re-reading an immutable asset body.
 * Fresh child hydration still parses and verifies the digest before use.
 */
export const assertRevealContinuationAssetPresent = async (input: {
  readonly archiveRoot: string;
  readonly artifact: RevealContinuationAsset["artifact"];
  readonly ref: string;
}): Promise<void> => {
  const filePath = assetPathFor(input.archiveRoot, input.artifact, input.ref);
  await assertPreflightArchivePath(path.resolve(input.archiveRoot), filePath);
  const stats = await lstat(filePath);
  if (!stats.isFile() || stats.isSymbolicLink())
    throw new RevealContinuationError(CONTENT_ASSET_REGULAR_FILE_ERROR);
  if (stats.size > MAX_ASSET_BYTES)
    throw new RevealContinuationError(CONTENT_ASSET_SIZE_ERROR);
};
