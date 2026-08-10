import { readFile } from "node:fs/promises";
import path from "node:path";

import { mergeRuntimeLanes } from "./merge-runtime-lanes.ts";
import { parseRuntimeLaneAssignment } from "./runtime-lane-contract.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime lane merger requires ${name}`);
  return value;
};

async function main(): Promise<void> {
  const assignmentPath = path.resolve(
    requiredEnv("RUNTIME_SWEEP_LANE_ASSIGNMENT"),
  );
  const assignment = parseRuntimeLaneAssignment(
    JSON.parse(await readFile(assignmentPath, "utf8")),
  );
  const result = await mergeRuntimeLanes({
    assignment,
    reportPath: path.resolve(
      process.env.RUNTIME_SWEEP_LANE_MERGE_REPORT?.trim() ||
        path.join(
          path.dirname(assignmentPath),
          `LANE-MERGE-${assignment.mode}.json`,
        ),
    ),
  });
  console.log(
    `runtime-lane-merge PASS cells=${result.cells} digest=${result.digest}`,
  );
}

void main().catch((error: unknown) => {
  console.error("[runtime-lane-merge] Failed:", error);
  process.exitCode = 1;
});
