import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, lstat, mkdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";

import type { RuntimeLaneAssignment } from "./runtime-lane-contract.ts";

export const RUNTIME_SOURCE_FILES = [
  ["SOURCE.json", "SOURCE"],
  ["PREFLIGHT.json", "PREFLIGHT"],
  ["MATRIX.json", "MATRIX"],
  ["MANIFEST.json", "MANIFEST"],
] as const;

const fileDigest = (content: Uint8Array): string =>
  createHash("sha256").update(content).digest("hex");

export const readFileDigest = async (filePath: string): Promise<string> =>
  fileDigest(await readFile(filePath));

const verifyDigest = async (
  filePath: string,
  expected: string,
): Promise<void> => {
  const actual = await readFileDigest(filePath);
  if (actual !== expected)
    throw new Error(
      `Runtime lane source digest mismatch for ${filePath}: ${actual} != ${expected}`,
    );
};

const assertRegularFile = async (filePath: string): Promise<void> => {
  const stat = await lstat(filePath);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    (await realpath(filePath)) !== path.resolve(filePath)
  )
    throw new Error(`Runtime artifact is not a regular file: ${filePath}`);
};

const copyOrVerify = async (
  source: string,
  target: string,
  expectedDigest: string,
): Promise<void> => {
  await assertRegularFile(source);
  await verifyDigest(source, expectedDigest);
  try {
    await copyFile(source, target, constants.COPYFILE_EXCL);
  } catch (error: unknown) {
    const code =
      error instanceof Error && "code" in error ? String(error.code) : "";
    if (code !== "EEXIST") throw error;
  }
  await assertRegularFile(target);
  await verifyDigest(target, expectedDigest);
};

const assertExistingSegments = async (
  candidates: readonly string[],
  index = 0,
): Promise<void> => {
  const candidate = candidates[index];
  if (candidate === undefined) return;
  try {
    const stat = await lstat(candidate);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error(
        `Runtime archive path is not a regular directory: ${candidate}`,
      );
    await assertExistingSegments(candidates, index + 1);
  } catch (error: unknown) {
    const code =
      error instanceof Error && "code" in error ? String(error.code) : "";
    if (code !== "ENOENT") throw error;
  }
};

const archiveChildSegments = (
  sourceRoot: string,
  childPath: string,
): readonly string[] => {
  const relative = path.relative(sourceRoot, childPath);
  if (
    !path.isAbsolute(sourceRoot) ||
    !path.isAbsolute(childPath) ||
    path.resolve(sourceRoot) !== sourceRoot ||
    path.resolve(childPath) !== childPath ||
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`)
  )
    throw new Error(`Runtime archive child escaped source root: ${childPath}`);
  return relative
    .split(path.sep)
    .filter((segment) => segment !== "")
    .map((_, index, segments) =>
      path.join(sourceRoot, ...segments.slice(0, index + 1)),
    );
};

export const assertArchiveChildBeforeCreate = async (
  sourceRoot: string,
  childPath: string,
): Promise<void> => {
  const sourceReal = await realpath(sourceRoot);
  if (sourceReal !== sourceRoot)
    throw new Error("Runtime source archive must not traverse a symlink");
  await assertExistingSegments(archiveChildSegments(sourceRoot, childPath));
};

export const assertArchiveChildAfterCreate = async (
  sourceRoot: string,
  childPath: string,
): Promise<void> => {
  await assertArchiveChildBeforeCreate(sourceRoot, childPath);
  const sourceReal = await realpath(sourceRoot);
  const childReal = await realpath(childPath);
  if (!childReal.startsWith(`${sourceReal}${path.sep}`))
    throw new Error(`Runtime archive escaped source archive: ${childPath}`);
};

export async function prepareRuntimeLaneArchives(
  assignment: RuntimeLaneAssignment,
): Promise<void> {
  await verifyRuntimeLaneSource(assignment);
  await Promise.all(
    assignment.lanes.map(async (lane) => {
      await assertArchiveChildBeforeCreate(
        assignment.sourceArchiveRoot,
        lane.archiveRoot,
      );
      await mkdir(lane.archiveRoot, { recursive: true });
      await assertArchiveChildAfterCreate(
        assignment.sourceArchiveRoot,
        lane.archiveRoot,
      );
      await Promise.all(
        RUNTIME_SOURCE_FILES.map(([fileName, key]) =>
          copyOrVerify(
            path.join(assignment.sourceArchiveRoot, fileName),
            path.join(lane.archiveRoot, fileName),
            assignment.sourceArtifacts[key],
          ),
        ),
      );
    }),
  );
}

export async function verifyRuntimeLaneSource(
  assignment: RuntimeLaneAssignment,
): Promise<void> {
  const rootStat = await lstat(assignment.sourceArchiveRoot);
  if (
    !rootStat.isDirectory() ||
    rootStat.isSymbolicLink() ||
    (await realpath(assignment.sourceArchiveRoot)) !==
      assignment.sourceArchiveRoot
  )
    throw new Error("Runtime source archive must not traverse a symlink");
  await Promise.all(
    RUNTIME_SOURCE_FILES.map(async ([fileName, key]) => {
      const filePath = path.join(assignment.sourceArchiveRoot, fileName);
      await assertRegularFile(filePath);
      await verifyDigest(filePath, assignment.sourceArtifacts[key]);
    }),
  );
}
