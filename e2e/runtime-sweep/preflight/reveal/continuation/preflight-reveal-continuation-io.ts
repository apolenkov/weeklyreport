import { link, lstat, open, readFile, unlink } from "node:fs/promises";
import * as path from "node:path";

import { freezeDeep } from "../../../source/manifest-source.ts";
import { stableSerialize } from "../../../support/ids.ts";
import {
  type PublicationCommitGuard,
  publishDeadlineBound,
} from "../../launch/preflight-deadline-publication.ts";
import {
  assertPreflightArchivePath,
  ensurePreflightArchiveDirectory,
} from "../../preflight-archive-path.ts";
import {
  type RevealBootstrap,
  type RevealExecutionGrant,
  type RevealParentPass,
  type RevealReceiptChunk,
} from "./contracts/preflight-reveal-continuation-schemas.ts";
import {
  parseRevealBootstrap,
  parseRevealExecutionGrant,
  parseRevealParentPass,
  parseRevealReceiptChunk,
} from "./preflight-reveal-continuation-artifacts.ts";
import { serializeV4 } from "./preflight-reveal-continuation-artifacts.ts";
import { MAX_ASSET_BYTES } from "./preflight-reveal-continuation-assets.ts";
import { RevealContinuationError } from "./preflight-reveal-continuation-errors.ts";

const PRIVATE_FILE_MODE = 0o600;
const MAX_ARTIFACT_BYTES = MAX_ASSET_BYTES;
const temporaryCounter = { value: 0 };

const missingFile = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

const assertArtifactPath = (archiveRoot: string, filePath: string): void => {
  const root = path.resolve(archiveRoot);
  const resolved = path.resolve(filePath);
  const relative = path.relative(root, resolved);
  if (
    relative === "" ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new RevealContinuationError(
      "R188 artifact path escapes the archive root",
    );
};

const assertRegularFile = async (filePath: string): Promise<void> => {
  const stats = await lstat(filePath);
  if (!stats.isFile() || stats.isSymbolicLink())
    throw new RevealContinuationError(
      "R188 artifact must be a regular non-symlink file",
    );
  if (stats.size > MAX_ARTIFACT_BYTES)
    throw new RevealContinuationError("R188 artifact exceeds the byte bound");
};

const writeTemporaryArtifact = async (input: {
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

const linkOrVerifyArtifact = async (input: {
  readonly temporaryPath: string;
  readonly filePath: string;
  readonly text: string;
  readonly markOwned: () => void;
}): Promise<void> => {
  try {
    await link(input.temporaryPath, input.filePath);
    input.markOwned();
    await unlink(input.temporaryPath);
    return;
  } catch (error: unknown) {
    const isExisting =
      error instanceof Error && "code" in error && error.code === "EEXIST";
    if (!isExisting) throw error;
    await assertRegularFile(input.filePath);
    const existing = await readFile(input.filePath, "utf8");
    if (existing !== input.text)
      throw new RevealContinuationError(
        "R188 immutable artifact collision has different bytes",
      );
    await unlink(input.temporaryPath);
  }
};

const writeImmutableJson = async (input: {
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly value: unknown;
  readonly parse: (value: unknown) => unknown;
  readonly commitGuard?: PublicationCommitGuard;
}): Promise<void> => {
  const root = path.resolve(input.archiveRoot);
  const filePath = path.resolve(input.filePath);
  assertArtifactPath(root, filePath);
  await ensurePreflightArchiveDirectory(root, path.dirname(filePath));
  await assertPreflightArchivePath(root, filePath);
  const parsed = input.parse(input.value);
  const text = serializeV4(parsed);
  if (Buffer.byteLength(text, "utf8") > MAX_ARTIFACT_BYTES)
    throw new RevealContinuationError("R188 artifact exceeds the byte bound");
  temporaryCounter.value += 1;
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${String(temporaryCounter.value)}.tmp`,
  );
  await assertPreflightArchivePath(root, temporaryPath);
  try {
    await writeTemporaryArtifact({ temporaryPath, text });
    await publishDeadlineBound({
      ...(input.commitGuard === undefined ? {} : { guard: input.commitGuard }),
      publish: async (markOwned) => {
        await linkOrVerifyArtifact({
          temporaryPath,
          filePath,
          text,
          markOwned,
        });
      },
      rollback: () => unlink(filePath),
    });
  } catch (error: unknown) {
    await unlink(temporaryPath).catch(() => undefined);
    if (error instanceof RevealContinuationError) throw error;
    throw new RevealContinuationError(
      `Cannot durably write R188 artifact: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const parseCanonicalText = <T>(
  text: string,
  parse: (value: unknown) => T,
): T => {
  if (!text.endsWith("\n"))
    throw new RevealContinuationError("R188 artifact bytes are not canonical");
  try {
    const value: unknown = JSON.parse(text);
    const parsed = parse(value);
    if (stableSerialize(parsed) !== text.slice(0, -1))
      throw new RevealContinuationError(
        "R188 artifact bytes are not canonical",
      );
    return freezeDeep(parsed);
  } catch (error: unknown) {
    if (error instanceof RevealContinuationError) throw error;
    throw new RevealContinuationError(
      `Cannot parse R188 artifact: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const readCanonicalJson = async <T>(input: {
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly parse: (value: unknown) => T;
}): Promise<T | undefined> => {
  const root = path.resolve(input.archiveRoot);
  const filePath = path.resolve(input.filePath);
  assertArtifactPath(root, filePath);
  await assertPreflightArchivePath(root, filePath);
  try {
    await assertRegularFile(filePath);
    return parseCanonicalText(await readFile(filePath, "utf8"), input.parse);
  } catch (error: unknown) {
    if (missingFile(error)) return undefined;
    if (error instanceof RevealContinuationError) throw error;
    throw new RevealContinuationError(
      `Cannot read R188 artifact: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/** Write a strict, immutable continuation-family JSON artifact with a caller-owned schema. */
export const writeRevealContinuationJson = async <T>(input: {
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly value: T;
  readonly parse: (value: unknown) => T;
  readonly commitGuard?: PublicationCommitGuard;
}): Promise<void> =>
  writeImmutableJson({
    archiveRoot: input.archiveRoot,
    filePath: input.filePath,
    value: input.value,
    parse: input.parse,
    ...(input.commitGuard === undefined
      ? {}
      : { commitGuard: input.commitGuard }),
  });

export async function assertRevealContinuationOutputAbsent(input: {
  readonly archiveRoot: string;
  readonly filePath: string;
}): Promise<void> {
  const root = path.resolve(input.archiveRoot);
  const filePath = path.resolve(input.filePath);
  assertArtifactPath(root, filePath);
  await assertPreflightArchivePath(root, filePath);
  try {
    await lstat(filePath);
    throw new RevealContinuationError(
      `R188 output path already exists: ${filePath}`,
    );
  } catch (error: unknown) {
    if (!missingFile(error)) throw error;
  }
}

export const writeRevealContinuationGrant = async (input: {
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly grant: RevealExecutionGrant;
}): Promise<void> =>
  writeImmutableJson({
    archiveRoot: input.archiveRoot,
    filePath: input.filePath,
    value: input.grant,
    parse: parseRevealExecutionGrant,
  });

export const writeRevealBootstrap = async (input: {
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly bootstrap: RevealBootstrap;
}): Promise<void> =>
  writeImmutableJson({
    archiveRoot: input.archiveRoot,
    filePath: input.filePath,
    value: input.bootstrap,
    parse: parseRevealBootstrap,
  });

export const readRevealContinuationGrant = async (input: {
  readonly archiveRoot: string;
  readonly filePath: string;
}): Promise<RevealExecutionGrant | undefined> =>
  readCanonicalJson({
    archiveRoot: input.archiveRoot,
    filePath: input.filePath,
    parse: parseRevealExecutionGrant,
  });

export const writeRevealReceiptChunk = async (input: {
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly chunk: RevealReceiptChunk;
}): Promise<void> =>
  writeImmutableJson({
    archiveRoot: input.archiveRoot,
    filePath: input.filePath,
    value: input.chunk,
    parse: parseRevealReceiptChunk,
  });

export const writeRevealParentPass = async (input: {
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly pass: RevealParentPass;
  readonly commitGuard?: PublicationCommitGuard;
}): Promise<void> =>
  writeImmutableJson({
    archiveRoot: input.archiveRoot,
    filePath: input.filePath,
    value: input.pass,
    parse: parseRevealParentPass,
    ...(input.commitGuard === undefined
      ? {}
      : { commitGuard: input.commitGuard }),
  });

export { hydrateRevealContinuationAssets } from "./preflight-reveal-continuation-hydration.ts";
export { readRevealContinuationArtifact } from "./preflight-reveal-continuation-io-child.ts";
