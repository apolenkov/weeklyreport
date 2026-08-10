import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  type FrozenMatrix,
  parseFrozenMatrix,
} from "../matrix/matrix-finalizer.ts";
import { createFrozenCaseLiveShardPlan } from "../replay/frozen-case-live-shards.ts";
import {
  campaignManifestSchema,
  type SeedProfile,
} from "../source/contracts.ts";
import {
  createRuntimeLaneAssignment,
  type RuntimeLaneAssignment,
  type RuntimeLaneMode,
  runtimeLaneResources,
} from "./runtime-lane-contract.ts";

const SOURCE_ARTIFACTS = [
  "SOURCE.json",
  "PREFLIGHT.json",
  "MATRIX.json",
  "MANIFEST.json",
] as const;
const MANIFEST_CONTENT_INDEX = SOURCE_ARTIFACTS.length - 1;

type AssignmentGroup = Readonly<{
  readonly profile: SeedProfile;
  readonly caseIds: readonly string[];
}>;
type LaneWork = Readonly<{
  readonly groups: readonly AssignmentGroup[];
  readonly caseCount: number;
}>;

const digest = (content: Uint8Array): string =>
  createHash("sha256").update(content).digest("hex");

const readJson = async (filePath: string): Promise<unknown> =>
  JSON.parse(await readFile(filePath, "utf8"));

const sourceArtifactDigests = async (
  archiveRoot: string,
): Promise<RuntimeLaneAssignment["sourceArtifacts"]> => {
  const contents = await Promise.all(
    SOURCE_ARTIFACTS.map((name) => readFile(path.join(archiveRoot, name))),
  );
  const contentAt = (index: number): Uint8Array => {
    const content = contents[index];
    if (content === undefined)
      throw new Error(`Runtime source artifact ${index} is missing`);
    return content;
  };
  return {
    SOURCE: digest(contentAt(0)),
    PREFLIGHT: digest(contentAt(1)),
    MATRIX: digest(contentAt(2)),
    MANIFEST: digest(contentAt(MANIFEST_CONTENT_INDEX)),
  };
};

const groupsForProfile = (
  matrix: FrozenMatrix,
  profile: SeedProfile,
): readonly AssignmentGroup[] =>
  createFrozenCaseLiveShardPlan(
    matrix.cases.filter(({ profile: candidate }) => candidate === profile),
  ).map(({ caseIds }) => ({ profile, caseIds }));

const canaryGroups = (
  groups: readonly AssignmentGroup[],
  mode: Exclude<RuntimeLaneMode, "full">,
  laneCount: number,
): readonly AssignmentGroup[] => {
  const selected = groups.slice(0, laneCount);
  if (selected.length !== laneCount)
    throw new Error(
      `Runtime lane ${mode} canary requires ${laneCount} frozen shards`,
    );
  return mode === "one-shard"
    ? selected
    : selected.map(({ profile, caseIds }) => {
        const first = caseIds[0];
        if (first === undefined)
          throw new Error("Runtime lane canary shard is empty");
        return { profile, caseIds: [first] };
      });
};

const targetLaneIndex = (lanes: readonly LaneWork[]): number =>
  lanes.reduce(
    (best, lane, index) =>
      lane.caseCount < (lanes[best]?.caseCount ?? Number.MAX_SAFE_INTEGER)
        ? index
        : best,
    0,
  );

const distribute = (
  groups: readonly AssignmentGroup[],
  laneCount: number,
): readonly LaneWork[] =>
  groups.reduce<readonly LaneWork[]>(
    (lanes, group) => {
      const index = targetLaneIndex(lanes);
      return lanes.map((lane, laneIndex) =>
        laneIndex === index
          ? {
              groups: [...lane.groups, group],
              caseCount: lane.caseCount + group.caseIds.length,
            }
          : lane,
      );
    },
    runtimeLaneResources(laneCount).map(() => ({ groups: [], caseCount: 0 })),
  );

export async function planRuntimeLanes(
  input: Readonly<{
    readonly archiveRoot: string;
    readonly laneRoot: string;
    readonly profiles: readonly SeedProfile[];
    readonly mode: RuntimeLaneMode;
    readonly laneCount: number;
  }>,
): Promise<RuntimeLaneAssignment> {
  const archiveRoot = path.resolve(input.archiveRoot);
  const laneRoot = path.resolve(input.laneRoot);
  const matrix = parseFrozenMatrix(
    await readJson(path.join(archiveRoot, "MATRIX.json")),
  );
  const manifest = campaignManifestSchema.parse(
    await readJson(path.join(archiveRoot, "MANIFEST.json")),
  );
  if (
    manifest.sourceSha !== matrix.sourceSha ||
    manifest.matrixDigest !== matrix.digest
  )
    throw new Error("Runtime lane source MANIFEST and MATRIX do not match");
  const allGroups = input.profiles.flatMap((profile) =>
    groupsForProfile(matrix, profile),
  );
  const selectedGroups =
    input.mode === "full"
      ? allGroups
      : canaryGroups(allGroups, input.mode, input.laneCount);
  const work = distribute(selectedGroups, input.laneCount);
  return createRuntimeLaneAssignment({
    artifact: "RUNTIME_LANE_ASSIGNMENT",
    version: 1,
    sourceSha: matrix.sourceSha,
    matrixDigest: matrix.digest,
    mode: input.mode,
    sourceArchiveRoot: archiveRoot,
    sourceArtifacts: await sourceArtifactDigests(archiveRoot),
    profiles: input.profiles,
    lanes: runtimeLaneResources(input.laneCount).map((resource, index) => ({
      ...resource,
      archiveRoot: path.join(laneRoot, resource.laneId),
      groups: work[index]?.groups ?? [],
    })),
  });
}
