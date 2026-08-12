import { readFile } from "node:fs/promises";
import path from "node:path";

import { runRuntimeLanes } from "./run-runtime-lanes.ts";
import { parseRuntimeLaneAssignment } from "./runtime-lane-contract.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime lane runner requires ${name}`);
  return value;
};

async function main(): Promise<void> {
  requiredEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION");
  const assignmentPath = path.resolve(
    requiredEnv("RUNTIME_SWEEP_LANE_ASSIGNMENT"),
  );
  const assignment = parseRuntimeLaneAssignment(
    JSON.parse(await readFile(assignmentPath, "utf8")),
  );
  await runRuntimeLanes({
    assignmentPath,
    assignment,
    baseDatabaseUrl: requiredEnv("E2E_DATABASE_URL"),
    redisRecreationAuthorized:
      requiredEnv("RUNTIME_SWEEP_REDIS_RECREATE") === "true",
  });
  console.log(
    `runtime-lanes PASS mode=${assignment.mode} digest=${assignment.assignmentDigest}`,
  );
}

void main().catch((error: unknown) => {
  console.error("[runtime-lanes] Failed:", error);
  process.exitCode = 1;
});
