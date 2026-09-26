import { createHash } from "node:crypto";
import { type BigIntStats, constants as fsConstants } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import { link, lstat, open, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type FileAnomaly =
  "missing" | "symlink" | "not-regular" | "checksum-mismatch" | "unreadable";

export interface VerifiedArtifact {
  readonly sha256: string;
  readonly dev: bigint;
  readonly inode: bigint;
}

export type ArtifactVerification =
  | { readonly ok: true; readonly file: VerifiedArtifact }
  | { readonly ok: false; readonly reason: FileAnomaly };

export class ArtifactPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactPathError";
  }
}

export const artifactPath = (root: string, fileName: string): string => {
  const resolved = resolve(root, fileName);
  if (dirname(resolved) !== resolve(root)) {
    throw new ArtifactPathError(
      `artifact name escapes the artifact root: ${fileName}`,
    );
  }
  return resolved;
};

const isFsError = (error: unknown, code: string): boolean =>
  error instanceof Error &&
  "code" in error &&
  (error as NodeJS.ErrnoException).code === code;

export const lstatMaybe = async (
  path: string,
): Promise<BigIntStats | undefined> => {
  try {
    return await lstat(path, { bigint: true });
  } catch (error) {
    if (isFsError(error, "ENOENT")) return undefined;
    throw error;
  }
};

type OpenedArtifact =
  | { readonly ok: true; readonly handle: FileHandle }
  | { readonly ok: false; readonly reason: "symlink" | "unreadable" };

const openUnfollowed = async (path: string): Promise<OpenedArtifact> => {
  try {
    const handle = await open(
      path,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
    );
    return { ok: true, handle };
  } catch (error) {
    if (isFsError(error, "ELOOP")) return { ok: false, reason: "symlink" };
    return { ok: false, reason: "unreadable" };
  }
};

export const verifyArtifactFile = async (
  path: string,
  expectedSha256: string,
): Promise<ArtifactVerification> => {
  const stats = await lstatMaybe(path);
  if (stats === undefined) return { ok: false, reason: "missing" };
  if (stats.isSymbolicLink()) return { ok: false, reason: "symlink" };
  if (!stats.isFile()) return { ok: false, reason: "not-regular" };

  const opened = await openUnfollowed(path);
  if (!opened.ok) return { ok: false, reason: opened.reason };
  try {
    const openedStats = await opened.handle.stat({ bigint: true });
    if (!openedStats.isFile()) return { ok: false, reason: "not-regular" };
    const bytes = await opened.handle.readFile();
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== expectedSha256.toLowerCase()) {
      return { ok: false, reason: "checksum-mismatch" };
    }
    return {
      ok: true,
      file: { sha256, dev: openedStats.dev, inode: openedStats.ino },
    };
  } finally {
    await opened.handle.close();
  }
};

export const linkNoOverwrite = async (
  sourcePath: string,
  linkPath: string,
): Promise<"linked" | "exists"> => {
  try {
    await link(sourcePath, linkPath);
    return "linked";
  } catch (error) {
    if (isFsError(error, "EEXIST")) return "exists";
    throw error;
  }
};

export const unlinkFile = async (path: string): Promise<void> => {
  await unlink(path);
};

export const syncDirectory = async (directoryPath: string): Promise<void> => {
  const handle = await open(directoryPath, fsConstants.O_RDONLY);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
};
