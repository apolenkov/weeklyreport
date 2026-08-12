import { lstat, mkdir, realpath } from "node:fs/promises";
import * as path from "node:path";

/**
 * Guards the archive boundary used by preflight state artifacts.
 * Archive paths are deliberately stricter than ordinary output paths: the
 * root must be a real non-root directory and every existing path component
 * must be a regular directory, never a symlink.
 */
export class PreflightArchivePathError extends Error {
  override readonly name = "PreflightArchivePathError";
}

const ARCHIVE_ROOT = "Preflight archive root";
const ARCHIVE_PATH = "Preflight archive path";
const ARCHIVE_DIRECTORY = "Preflight archive directory";
const ARCHIVE_FILE = "Preflight archive file";

const isMissing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

const normalizedAbsolute = (value: string, label: string): string => {
  const resolved = path.resolve(value);
  if (
    !path.isAbsolute(value) ||
    resolved !== value ||
    resolved === path.parse(resolved).root
  )
    throw new PreflightArchivePathError(
      `${label} must be a normalized absolute non-root path`,
    );
  return resolved;
};

const relativeChild = (root: string, candidate: string): string => {
  const relative = path.relative(root, candidate);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new PreflightArchivePathError(
      `Preflight archive path escaped archive root: ${candidate}`,
    );
  return relative;
};

const assertDirectory = async (
  candidate: string,
  label: string,
): Promise<void> => {
  const stat = await lstat(candidate).catch((error: unknown) => {
    if (isMissing(error))
      throw new PreflightArchivePathError(
        `${label} does not exist: ${candidate}`,
      );
    throw error;
  });
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new PreflightArchivePathError(
      `${label} must be a regular directory: ${candidate}`,
    );
  if ((await realpath(candidate)) !== candidate)
    throw new PreflightArchivePathError(
      `${label} must not traverse a symlink: ${candidate}`,
    );
};

const assertExistingSegment = async (candidate: string): Promise<boolean> => {
  try {
    const stat = await lstat(candidate);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new PreflightArchivePathError(
        `${ARCHIVE_PATH} is not a regular directory: ${candidate}`,
      );
    if ((await realpath(candidate)) !== candidate)
      throw new PreflightArchivePathError(
        `${ARCHIVE_PATH} traverses a symlink: ${candidate}`,
      );
    return true;
  } catch (error: unknown) {
    if (isMissing(error)) return false;
    throw error;
  }
};

const existingSegments = async (
  root: string,
  relative: string,
): Promise<void> => {
  const segments = relative.split(path.sep).filter(Boolean);
  for (const [index] of segments.entries()) {
    const candidate = path.join(root, ...segments.slice(0, index + 1));
    if (!(await assertExistingSegment(candidate))) return;
  }
};

export async function ensurePreflightArchiveRoot(
  value: string,
): Promise<string> {
  const root = normalizedAbsolute(value, ARCHIVE_ROOT);
  const parent = path.dirname(root);
  await existingSegments(
    path.parse(parent).root,
    path.relative(path.parse(parent).root, parent),
  );
  await mkdir(root, { recursive: true });
  await assertDirectory(root, ARCHIVE_ROOT);
  return root;
}

/**
 * Validates a path below an already-created archive root. The leaf may be
 * absent (the caller can create it with an exclusive flag), but existing
 * components must remain regular, non-symlink paths.
 */
export async function assertPreflightArchivePath(
  archiveRoot: string,
  candidatePath: string,
): Promise<string> {
  const root = normalizedAbsolute(archiveRoot, ARCHIVE_ROOT);
  const candidate = normalizedAbsolute(candidatePath, ARCHIVE_PATH);
  relativeChild(root, candidate);
  await assertDirectory(root, ARCHIVE_ROOT);
  const relative = path.relative(root, candidate);
  const parent = path.dirname(candidate);
  const parentRelative = path.relative(root, parent);
  await existingSegments(root, parentRelative);
  try {
    const stat = await lstat(candidate);
    if (stat.isSymbolicLink())
      throw new PreflightArchivePathError(
        `Preflight archive path must not be a symlink: ${candidate}`,
      );
    if (!stat.isFile())
      throw new PreflightArchivePathError(
        `Preflight archive path must be a regular file: ${candidate}`,
      );
    if ((await realpath(candidate)) !== candidate)
      throw new PreflightArchivePathError(
        `Preflight archive path traverses a symlink: ${candidate}`,
      );
  } catch (error: unknown) {
    if (!isMissing(error)) throw error;
  }
  return relative;
}

export async function ensurePreflightArchiveDirectory(
  archiveRoot: string,
  directoryPath: string,
): Promise<string> {
  const root = await ensurePreflightArchiveRoot(archiveRoot);
  const directory = normalizedAbsolute(directoryPath, ARCHIVE_DIRECTORY);
  relativeChild(root, directory);
  await assertPreflightArchivePath(
    root,
    path.join(directory, ".directory-marker"),
  );
  await mkdir(directory, { recursive: true });
  await assertDirectory(directory, ARCHIVE_DIRECTORY);
  return directory;
}

export async function assertPreflightRegularFile(
  filePath: string,
): Promise<void> {
  const candidate = normalizedAbsolute(filePath, ARCHIVE_FILE);
  const stat = await lstat(candidate).catch(() => {
    throw new PreflightArchivePathError(
      `Preflight archive file is unavailable: ${candidate}`,
    );
  });
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new PreflightArchivePathError(
      `Preflight archive file must be a regular non-symlink file: ${candidate}`,
    );
}
