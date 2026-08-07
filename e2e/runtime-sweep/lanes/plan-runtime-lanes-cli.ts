import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { type SeedProfile, seedProfileSchema } from "../source/contracts.ts";
import { stableSerialize } from "../support/ids.ts";
import { planRuntimeLanes } from "./plan-runtime-lanes.ts";
import {
  DEFAULT_RUNTIME_LANE_COUNT,
  MAX_RUNTIME_LANE_COUNT,
  MIN_RUNTIME_LANE_COUNT,
  type RuntimeLaneMode,
} from "./runtime-lane-contract.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime lane planner requires ${name}`);
  return value;
};

const profilesFrom = (value: string): readonly SeedProfile[] => {
  const profiles = value
    .split(",")
    .map((profile) => seedProfileSchema.parse(profile));
  if (new Set(profiles).size !== profiles.length)
    throw new Error("RUNTIME_SWEEP_LANE_PROFILES contains duplicates");
  return profiles;
};

const modeFrom = (value: string): RuntimeLaneMode => {
  if (value === "one-cell" || value === "one-shard" || value === "full")
    return value;
  throw new Error(
    "RUNTIME_SWEEP_LANE_MODE must be one-cell, one-shard, or full",
  );
};

const laneCountFrom = (value: string | undefined): number => {
  const normalized = value?.trim();
  if (normalized === undefined || normalized === "")
    return DEFAULT_RUNTIME_LANE_COUNT;
  const laneCount = Number(normalized);
  if (
    !Number.isInteger(laneCount) ||
    laneCount < MIN_RUNTIME_LANE_COUNT ||
    laneCount > MAX_RUNTIME_LANE_COUNT
  )
    throw new Error(
      `RUNTIME_SWEEP_LANE_COUNT must be an integer from ${MIN_RUNTIME_LANE_COUNT} to ${MAX_RUNTIME_LANE_COUNT}`,
    );
  return laneCount;
};

async function main(): Promise<void> {
  const archiveRoot = path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE"));
  const mode = modeFrom(requiredEnv("RUNTIME_SWEEP_LANE_MODE"));
  const outputPath = path.resolve(
    process.env.RUNTIME_SWEEP_LANE_ASSIGNMENT?.trim() ||
      path.join(archiveRoot, `LANE-ASSIGNMENT-${mode}.json`),
  );
  const assignment = await planRuntimeLanes({
    archiveRoot,
    laneRoot: path.resolve(
      process.env.RUNTIME_SWEEP_LANE_ROOT?.trim() ||
        path.join(archiveRoot, "lanes", mode),
    ),
    profiles: profilesFrom(requiredEnv("RUNTIME_SWEEP_LANE_PROFILES")),
    mode,
    laneCount: laneCountFrom(process.env.RUNTIME_SWEEP_LANE_COUNT),
  });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${stableSerialize(assignment)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  console.log(
    `runtime-lane-plan PASS mode=${assignment.mode} lanes=${assignment.lanes.length} cells=${assignment.lanes.reduce((total, lane) => total + lane.groups.reduce((count, group) => count + group.caseIds.length, 0), 0)} output=${outputPath}`,
  );
}

void main().catch((error: unknown) => {
  console.error("[runtime-lane-plan] Failed:", error);
  process.exitCode = 1;
});
