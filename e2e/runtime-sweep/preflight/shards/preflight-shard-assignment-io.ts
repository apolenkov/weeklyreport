import { lstat, readFile } from "node:fs/promises";

import { writeManifestFile } from "../../source/manifest-source.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import { stableSerialize } from "../../support/ids.ts";
import { errorMessage } from "../journal/preflight-journal-contract.ts";
import {
  assertPreflightArchivePath,
  assertPreflightRegularFile,
  ensurePreflightArchiveRoot,
  PreflightArchivePathError,
} from "../preflight-archive-path.ts";
import {
  type PreflightShardAssignment,
  PreflightShardAssignmentError,
} from "./preflight-shard-assignment-contract.ts";
import {
  assertPreflightShardAssignmentMatchesSource,
  assertPreflightShardCount,
  createPreflightShardAssignment,
} from "./preflight-shard-assignment-planner.ts";
import { parsePreflightShardAssignment } from "./preflight-shard-assignment-validation.ts";

export const serializePreflightShardAssignment = (
  assignment: PreflightShardAssignment,
): string => `${stableSerialize(parsePreflightShardAssignment(assignment))}\n`;

export async function readPreflightShardAssignment(
  filePath: string,
): Promise<PreflightShardAssignment> {
  try {
    await assertPreflightRegularFile(filePath);
    const text = await readFile(filePath, "utf8");
    const parsed = parsePreflightShardAssignment(JSON.parse(text) as unknown);
    if (text !== serializePreflightShardAssignment(parsed))
      throw new PreflightShardAssignmentError(
        "PREFLIGHT_SHARD_ASSIGNMENT bytes are not canonical",
      );
    return parsed;
  } catch (error: unknown) {
    if (
      error instanceof PreflightShardAssignmentError ||
      error instanceof PreflightArchivePathError
    )
      throw error;
    throw new PreflightShardAssignmentError(
      `Cannot read PREFLIGHT_SHARD_ASSIGNMENT.json: ${errorMessage(error)}`,
    );
  }
}

export async function writePreflightShardAssignment(input: {
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly assignment: PreflightShardAssignment;
}): Promise<void> {
  const archiveRoot = await ensurePreflightArchiveRoot(input.archiveRoot);
  await assertPreflightArchivePath(archiveRoot, input.filePath);
  await writeManifestFile(
    input.filePath,
    serializePreflightShardAssignment(input.assignment),
  );
  await assertPreflightRegularFile(input.filePath);
  await readPreflightShardAssignment(input.filePath);
}

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await lstat(filePath);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return false;
    throw error;
  }
};

export async function readOrCreatePreflightShardAssignment(input: {
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly source: SourceArtifact;
  readonly shardCount: number;
}): Promise<PreflightShardAssignment> {
  assertPreflightShardCount(input.source, input.shardCount);
  const archiveRoot = await ensurePreflightArchiveRoot(input.archiveRoot);
  await assertPreflightArchivePath(archiveRoot, input.filePath);
  if (await fileExists(input.filePath)) {
    const assignment = await readPreflightShardAssignment(input.filePath);
    if (assignment.shardCount !== input.shardCount)
      throw new PreflightShardAssignmentError(
        `PREFLIGHT_SHARD_ASSIGNMENT stored shard count ${assignment.shardCount} does not match requested shard count ${input.shardCount}`,
      );
    assertPreflightShardAssignmentMatchesSource(input.source, assignment);
    return assignment;
  }
  const assignment = createPreflightShardAssignment(
    input.source,
    input.shardCount,
  );
  await writePreflightShardAssignment({
    archiveRoot,
    filePath: input.filePath,
    assignment,
  });
  return assignment;
}
