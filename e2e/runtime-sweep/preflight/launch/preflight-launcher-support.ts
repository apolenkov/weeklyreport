import type { SourceArtifact } from "../../source/source-artifact.ts";
import { readOrCreatePreflightAssignment } from "../artifacts/preflight-assignment.ts";
import {
  assertPreflightArchivePath,
  ensurePreflightArchiveDirectory,
  ensurePreflightArchiveRoot,
} from "../preflight-archive-path.ts";

export type PreflightFullPaths = Readonly<{
  readonly preflightPath: string;
  readonly assignmentPath: string;
  readonly journalPath: string;
  readonly segmentRoot: string;
}>;

const PREFLIGHT_ARTIFACT_ENV_KEYS = [
  "RUNTIME_SWEEP_PREFLIGHT",
  "RUNTIME_SWEEP_PREFLIGHT_ASSIGNMENT",
  "RUNTIME_SWEEP_PREFLIGHT_JOURNAL",
  "RUNTIME_SWEEP_PREFLIGHT_SEGMENTS",
  "RUNTIME_SWEEP_PREFLIGHT_HOST_CHECKPOINT_ROOT",
] as const;

/**
 * Validates and freezes the full-preflight output set immediately before the
 * full child is spawned. Assignment creation is deliberately part of this
 * boundary, so a repair canary never needs to touch a stale journal first.
 */
export async function preparePreflightFullPaths(input: {
  readonly archiveRoot: string;
  readonly source: SourceArtifact;
  readonly preflightPath: string;
  readonly assignmentPath: string;
  readonly journalPath: string;
  readonly segmentRoot: string;
}): Promise<PreflightFullPaths> {
  const archiveRoot = await ensurePreflightArchiveRoot(input.archiveRoot);
  await assertPreflightArchivePath(archiveRoot, input.preflightPath);
  await assertPreflightArchivePath(archiveRoot, input.assignmentPath);
  await assertPreflightArchivePath(archiveRoot, input.journalPath);
  const segmentRoot = await ensurePreflightArchiveDirectory(
    archiveRoot,
    input.segmentRoot,
  );
  await readOrCreatePreflightAssignment({
    archiveRoot,
    filePath: input.assignmentPath,
    source: input.source,
  });
  return {
    preflightPath: input.preflightPath,
    assignmentPath: input.assignmentPath,
    journalPath: input.journalPath,
    segmentRoot,
  };
}

export function preflightChildEnvironment(
  inherited: NodeJS.ProcessEnv,
  mode: "canary" | "full",
  paths?: PreflightFullPaths,
): NodeJS.ProcessEnv {
  const filtered = Object.fromEntries(
    Object.entries(inherited).filter(
      ([key]) =>
        !PREFLIGHT_ARTIFACT_ENV_KEYS.includes(
          key as (typeof PREFLIGHT_ARTIFACT_ENV_KEYS)[number],
        ),
    ),
  );
  return {
    ...filtered,
    RUNTIME_SWEEP_PREFLIGHT_MODE: mode,
    ...(paths === undefined
      ? {}
      : {
          RUNTIME_SWEEP_PREFLIGHT: paths.preflightPath,
          RUNTIME_SWEEP_PREFLIGHT_ASSIGNMENT: paths.assignmentPath,
          RUNTIME_SWEEP_PREFLIGHT_JOURNAL: paths.journalPath,
          RUNTIME_SWEEP_PREFLIGHT_SEGMENTS: paths.segmentRoot,
        }),
  };
}
