import * as path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { assertE2eRuntimeDestructiveTarget } from "../../../prisma/guards/_destructive-guard.ts";
import { assertRuntimeSourceAuthorityFromEnvironment } from "../source/runtime-source-authority.ts";
import { assertLivePreflightSourceIdentity } from "./canary/preflight-canary-selection.ts";
import { assertDiagnosticFailureArtifacts } from "./diagnostics/preflight-diagnostic-artifacts.ts";
import {
  type DiagnosticHostEnvelopeCounters,
  type DiagnosticHostEnvelopeSnapshot,
  EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
  HOST_ENVELOPE_THRESHOLDS,
  hostEnvelopeModeFromEnvironment,
  hostEnvelopeOutputRootFromEnvironment,
  readDarwinHostEnvelopeSnapshot,
} from "./diagnostics/preflight-diagnostic-host-envelope.ts";
import { evaluateHostEnvelopeSample } from "./diagnostics/preflight-diagnostic-host-envelope-evaluator.ts";
import {
  createDiagnosticHostEnvelopeReceipt,
  readHealthyPreResourceReceipt,
} from "./diagnostics/preflight-diagnostic-host-envelope-receipt.ts";
import {
  assertDiagnosticCampaignBinding,
  assertDiagnosticOutputPath,
} from "./diagnostics/preflight-diagnostic-sidecar-contract.ts";
import { runControlledDiagnostic } from "./diagnostics/run-runtime-preflight-diagnostic-host-envelope.ts";
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

const PRE_RESOURCE_MANIFEST_ENV =
  "RUNTIME_SWEEP_DIAGNOSTIC_PRE_RESOURCE_MANIFEST";

const mode = process.argv[2];
if (mode !== "diagnostic" && mode !== "host-baseline")
  throw new Error(
    "Diagnostic preflight launcher requires diagnostic or host-baseline mode",
  );

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const sourceAuthority = await assertRuntimeSourceAuthorityFromEnvironment();
const archiveRoot = await ensurePreflightArchiveRoot(
  path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE")),
);

const collectBaseline = async (input: {
  readonly phase: "pre-resource" | "post-infrastructure";
  readonly sampleCount: number;
  readonly receipt: Awaited<
    ReturnType<typeof createDiagnosticHostEnvelopeReceipt>
  >;
}): Promise<
  Readonly<{
    readonly firstSnapshot: DiagnosticHostEnvelopeSnapshot;
    readonly lastSnapshot: DiagnosticHostEnvelopeSnapshot;
    readonly counters: DiagnosticHostEnvelopeCounters;
  }>
> => {
  const state: {
    previousCounters: DiagnosticHostEnvelopeCounters | undefined;
    firstSnapshot: DiagnosticHostEnvelopeSnapshot | undefined;
    lastSnapshot: DiagnosticHostEnvelopeSnapshot | undefined;
    breachStreaks: typeof EMPTY_HOST_ENVELOPE_BREACH_STREAKS;
  } = {
    previousCounters: undefined,
    firstSnapshot: undefined,
    lastSnapshot: undefined,
    breachStreaks: EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
  };
  for (const index of Array.from(
    { length: input.sampleCount },
    (_, value) => value,
  )) {
    const snapshot = await readDarwinHostEnvelopeSnapshot(input.phase);
    const evaluation = evaluateHostEnvelopeSample({
      snapshot,
      mode: "baseline",
      baselineSwapUsedBytes:
        state.firstSnapshot?.swapUsedBytes ?? snapshot.swapUsedBytes ?? 0,
      priorCounters: state.previousCounters,
      breachStreaks: state.breachStreaks,
    });
    await input.receipt.record({
      snapshot,
      status: evaluation.status,
      reasons: evaluation.reasons,
      breachStreaks: evaluation.breachStreaks,
    });
    if (
      evaluation.status !== "healthy" ||
      evaluation.nextCounters === undefined
    )
      throw new Error(
        `Host envelope baseline failed at sample ${index + 1}: ${evaluation.reasons.join(", ")}`,
      );
    state.previousCounters = evaluation.nextCounters;
    state.breachStreaks = evaluation.breachStreaks;
    state.firstSnapshot ??= snapshot;
    state.lastSnapshot = snapshot;
    if (index + 1 < input.sampleCount)
      await delay(HOST_ENVELOPE_THRESHOLDS.sampleIntervalMs);
  }
  if (
    state.firstSnapshot === undefined ||
    state.lastSnapshot === undefined ||
    state.previousCounters === undefined
  )
    throw new Error("Host envelope baseline produced no samples");
  return {
    firstSnapshot: state.firstSnapshot,
    lastSnapshot: state.lastSnapshot,
    counters: state.previousCounters,
  };
};

const runHostBaseline = async (): Promise<number> => {
  if (hostEnvelopeModeFromEnvironment(process.env) !== "enforce")
    throw new Error("host-baseline mode requires host envelope enforce mode");
  const outputRoot = hostEnvelopeOutputRootFromEnvironment(process.env);
  const sourcePath = path.resolve(requiredEnv("RUNTIME_SWEEP_SOURCE"));
  await assertPreflightArchivePath(archiveRoot, sourcePath);
  const source = sourceAuthority.source;
  await assertLivePreflightSourceIdentity({ source, repoRoot });
  const sourceSha = requiredEnv("RUNTIME_SWEEP_SOURCE_SHA");
  const sourceTree = requiredEnv("RUNTIME_SWEEP_SOURCE_TREE");
  if (sourceSha !== source.sourceSha || sourceTree !== source.sourceTree)
    throw new Error("Host baseline source identity does not match SOURCE.json");
  const campaignId = requiredEnv("RUNTIME_SWEEP_DIAGNOSTIC_CAMPAIGN_ID");
  assertDiagnosticCampaignBinding({
    requestedCampaignId: campaignId,
    sourceCampaignId: source.campaignId,
  });
  assertDiagnosticOutputPath({ archiveRoot, outputRoot });
  await ensurePreflightArchiveDirectory(archiveRoot, outputRoot);
  const receipt = await createDiagnosticHostEnvelopeReceipt({
    archiveRoot,
    outputRoot,
    sourceSha,
    sourceTree,
    campaignId,
  });
  try {
    await collectBaseline({
      phase: "pre-resource",
      sampleCount: HOST_ENVELOPE_THRESHOLDS.preResourceBaselineSamples,
      receipt,
    });
    await receipt.finalize({
      status: "healthy",
      reason: "pre-resource baseline passed",
    });
    return 0;
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    try {
      await receipt.finalize({ status: "inconclusive", reason });
    } catch {
      await receipt.closeWithoutManifest().catch(() => undefined);
    }
    return 1;
  }
};

if (mode === "host-baseline") {
  process.exitCode = await runHostBaseline();
} else {
  const databaseUrl = requiredEnv("E2E_DATABASE_URL");
  assertE2eRuntimeDestructiveTarget(
    "runtime-preflight-diagnostic-launch",
    databaseUrl,
    process.env,
  );
  const sourcePath = path.resolve(requiredEnv("RUNTIME_SWEEP_SOURCE"));
  await assertPreflightArchivePath(archiveRoot, sourcePath);
  const source = sourceAuthority.source;
  await assertLivePreflightSourceIdentity({ source, repoRoot });
  const stateId = requiredEnv("RUNTIME_SWEEP_DIAGNOSTIC_STATE_ID");
  if (!source.plan.states.some((state) => state.stateId === stateId))
    throw new Error(
      `Diagnostic state is not present in SOURCE.json: ${stateId}`,
    );
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

  const hostEnvelopeMode = hostEnvelopeModeFromEnvironment(environment);
  if (hostEnvelopeMode === "off") {
    const childExitCode = await runPreflightDiagnosticPlaywrightChild({
      repoRoot,
      environment,
    });
    if (childExitCode !== 0) {
      await assertDiagnosticFailureArtifacts({ outputRoot });
    }
    process.exitCode = childExitCode;
  } else {
    const pressureOutputRoot =
      hostEnvelopeOutputRootFromEnvironment(environment);
    await assertPreflightArchivePath(archiveRoot, pressureOutputRoot);
    const preResourceManifestPath = path.resolve(
      requiredEnv(PRE_RESOURCE_MANIFEST_ENV),
    );
    await readHealthyPreResourceReceipt({
      archiveRoot,
      manifestPath: preResourceManifestPath,
      sourceSha: source.sourceSha,
      sourceTree: source.sourceTree,
      campaignId,
      expectedRecordCount: HOST_ENVELOPE_THRESHOLDS.preResourceBaselineSamples,
    });
    process.exitCode = await runControlledDiagnostic({
      repoRoot,
      environment,
      archiveRoot,
      outputRoot: pressureOutputRoot,
      sourceSha: source.sourceSha,
      sourceTree: source.sourceTree,
      campaignId,
      collectBaseline,
    });
  }
}
