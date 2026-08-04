import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CANONICAL_ROLES, SEED_PROFILES } from "./contracts.js";
import {
  assertRuntimeSweepBaseURLLive,
  type DriveEnvironment,
  type DriverAssignment,
  DriverAssignmentError,
  readCampaignManifest,
  readCampaignMatrix,
  requireDriverEnvironment,
  resolveDriverAssignment,
  type RuntimeSweepLiveProbe,
  writeSkippedDrive,
} from "./driver-assignment.js";
import { driveShard } from "./run-opencode-shard.js";
export { type DriverPromptInput, renderDriverPrompt } from "./driver-prompt.js";
import { assertPlaywrightMcpConnected } from "./opencode-runner.js";
import { assertRuntimeSweepPlaywrightMcpTools } from "./playwright-mcp-preflight.js";

export {
  assertRuntimeSweepBaseURLLive,
  requireRuntimeSweepBaseURL,
} from "./driver-assignment.js";

const writeShardPlan = async (
  environment: DriveEnvironment,
  assignments: readonly DriverAssignment[],
): Promise<void> => {
  const shards = assignments.flatMap((assignment) => assignment.shards);
  const directory = path.join(
    environment.archive,
    "driver",
    environment.sourceSha,
  );
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "shard-plan.json"),
    `${JSON.stringify(
      {
        sourceSha: environment.sourceSha,
        totalShards: shards.length,
        shards,
      },
      null,
      2,
    )}\n`,
  );
};

async function driveAssignment(
  environment: DriveEnvironment,
  template: string,
  assignment: DriverAssignment,
): Promise<void> {
  if (assignment.status === "not-applicable") {
    await writeSkippedDrive(environment, assignment);
    return;
  }
  for (const route of assignment.routes)
    for (const shard of route.shards)
      await driveShard(
        environment,
        template,
        assignment.profile,
        assignment.role,
        shard,
      );
}

export interface OpenCodeDriveRunOptions {
  readonly baseURL?: string;
  readonly profile?: (typeof SEED_PROFILES)[number];
  readonly liveProbe?: RuntimeSweepLiveProbe;
}

export async function runOpenCodeDrives(
  options: OpenCodeDriveRunOptions = {},
): Promise<void> {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..");
  const environment = requireDriverEnvironment(repoRoot, options.baseURL);
  await assertRuntimeSweepBaseURLLive(environment.baseURL, options.liveProbe);
  const manifest = await readCampaignManifest(environment);
  if (manifest.sourceSha !== environment.sourceSha) {
    throw new DriverAssignmentError(
      `Manifest source SHA ${manifest.sourceSha} does not match ${environment.sourceSha}`,
    );
  }
  const matrixCases = await readCampaignMatrix(environment);
  const profiles = options.profile ? [options.profile] : SEED_PROFILES;
  const assignments = profiles.flatMap((profile) =>
    CANONICAL_ROLES.map((role) =>
      resolveDriverAssignment(manifest, profile, role, matrixCases),
    ),
  );
  await writeShardPlan(environment, assignments);
  const template = await readFile(
    path.join(repoRoot, "e2e/sweep/driver/drive-prompt.md"),
    "utf8",
  );
  await assertPlaywrightMcpConnected();
  await assertRuntimeSweepPlaywrightMcpTools();
  for (const assignment of assignments)
    await driveAssignment(environment, template, assignment);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runOpenCodeDrives();
}
