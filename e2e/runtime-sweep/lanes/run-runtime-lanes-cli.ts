import { readFile } from "node:fs/promises";
import path from "node:path";

import { assertE2eRuntimeDestructiveTarget } from "../../../prisma/guards/_destructive-guard.ts";
import { assertRuntimeSourceAuthorityFromEnvironment } from "../source/runtime-source-authority.ts";
import { parseRuntimeLaneAssignment } from "./contracts/runtime-lane-contract.ts";
import { runRuntimeLanes } from "./run-runtime-lanes.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime lane runner requires ${name}`);
  return value;
};

async function main(): Promise<void> {
  const sourceAuthority = await assertRuntimeSourceAuthorityFromEnvironment();
  const baseDatabaseUrl = requiredEnv("E2E_DATABASE_URL");
  assertE2eRuntimeDestructiveTarget(
    "runtime-lanes-cli",
    baseDatabaseUrl,
    process.env,
  );
  const assignmentPath = path.resolve(
    requiredEnv("RUNTIME_SWEEP_LANE_ASSIGNMENT"),
  );
  const assignment = parseRuntimeLaneAssignment(
    JSON.parse(await readFile(assignmentPath, "utf8")),
  );
  await runRuntimeLanes({
    assignmentPath,
    assignment,
    sourceAuthority: {
      expectedSource: sourceAuthority.source,
      receiptFileSha256: sourceAuthority.receiptFileSha256,
    },
    baseDatabaseUrl,
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
