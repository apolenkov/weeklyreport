import * as path from "node:path";

import { assertE2eRuntimeDestructiveTarget } from "../../../prisma/guards/_destructive-guard.ts";
import { readSourceArtifact } from "../source/source-artifact.ts";
import { assertLivePreflightSourceIdentity } from "./canary/preflight-canary-selection.ts";
import {
  assertDiagnosticCampaignBinding,
  assertDiagnosticOutputPath,
} from "./diagnostics/preflight-diagnostic-sidecar-contract.ts";
import { runPreflightDiagnosticPlaywrightChild } from "./launch/preflight-diagnostic-playwright-child.ts";
import {
  assertPreflightArchivePath,
  ensurePreflightArchiveDirectory,
  ensurePreflightArchiveRoot,
} from "./preflight-archive-path.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Diagnostic preflight launcher requires ${name}`);
  return value;
};

const mode = process.argv[2];
if (mode !== "diagnostic")
  throw new Error(
    "Diagnostic preflight launcher requires the diagnostic mode argument",
  );

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const databaseUrl = requiredEnv("E2E_DATABASE_URL");
assertE2eRuntimeDestructiveTarget(
  "runtime-preflight-diagnostic-launch",
  databaseUrl,
  process.env,
);
const archiveRoot = await ensurePreflightArchiveRoot(
  path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE")),
);
const sourcePath = path.resolve(requiredEnv("RUNTIME_SWEEP_SOURCE"));
await assertPreflightArchivePath(archiveRoot, sourcePath);
const source = await readSourceArtifact(sourcePath);
await assertLivePreflightSourceIdentity({ source, repoRoot });
const stateId = requiredEnv("RUNTIME_SWEEP_DIAGNOSTIC_STATE_ID");
if (!source.plan.states.some((state) => state.stateId === stateId))
  throw new Error(`Diagnostic state is not present in SOURCE.json: ${stateId}`);
const outputRoot = path.resolve(
  requiredEnv("RUNTIME_SWEEP_DIAGNOSTIC_OUTPUT_ROOT"),
);
assertDiagnosticOutputPath({ archiveRoot, outputRoot });
await ensurePreflightArchiveDirectory(archiveRoot, outputRoot);
const campaignId = requiredEnv("RUNTIME_SWEEP_DIAGNOSTIC_CAMPAIGN_ID");
assertDiagnosticCampaignBinding({
  requestedCampaignId: campaignId,
  sourceCampaignId: source.campaignId,
});

const environment: NodeJS.ProcessEnv = {
  ...process.env,
  RUNTIME_SWEEP_PREFLIGHT_MODE: "diagnostic",
  RUNTIME_SWEEP_SOURCE: sourcePath,
  RUNTIME_SWEEP_SOURCE_SHA: source.sourceSha,
  RUNTIME_SWEEP_DIAGNOSTIC_STATE_ID: stateId,
  RUNTIME_SWEEP_DIAGNOSTIC_OUTPUT_ROOT: outputRoot,
  RUNTIME_SWEEP_DIAGNOSTIC_CAMPAIGN_ID: campaignId,
};
for (const key of [
  "RUNTIME_SWEEP_PREFLIGHT",
  "RUNTIME_SWEEP_PREFLIGHT_ASSIGNMENT",
  "RUNTIME_SWEEP_PREFLIGHT_JOURNAL",
  "RUNTIME_SWEEP_PREFLIGHT_SEGMENTS",
  "RUNTIME_SWEEP_PREFLIGHT_CANARY",
])
  delete environment[key];

process.exitCode = await runPreflightDiagnosticPlaywrightChild({
  repoRoot,
  environment,
});
