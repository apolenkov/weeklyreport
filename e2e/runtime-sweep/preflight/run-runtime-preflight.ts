import * as path from "node:path";

import { assertE2eRuntimeDestructiveTarget } from "../../../prisma/guards/_destructive-guard.ts";
import { assertRuntimeSourceAuthorityFromEnvironment } from "../source/runtime-source-authority.ts";
import {
  assertLivePreflightSourceIdentity,
  assertPreflightCanaryPassForSource,
  preflightCanarySelectorFromEnvironment,
  readPreflightCanaryArtifact,
} from "./canary/preflight-canary.ts";
import { runExactAdminDemoRevealCanary } from "./launch/checkpoint/preflight-reveal-host-checkpoint-launch.ts";
import {
  assertPreflightLaunchGate,
  type PreflightLaunchMode,
} from "./launch/preflight-launch-guard.ts";
import {
  preflightChildEnvironment,
  type PreflightFullPaths,
  preparePreflightFullPaths,
} from "./launch/preflight-launcher-support.ts";
import { runPreflightPlaywrightChild } from "./launch/preflight-playwright-child.ts";
import { runPreflightRepairChain } from "./launch/preflight-repair-chain.ts";
import {
  preflightShardChildEnvironment,
  preparePreflightShardLaunch,
} from "./launch/preflight-shard-launcher-support.ts";
import {
  assertPreflightArchivePath,
  ensurePreflightArchiveRoot,
} from "./preflight-archive-path.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime preflight launcher requires ${name}`);
  return value;
};

const mode = process.argv[2];
const sourceAuthority = await assertRuntimeSourceAuthorityFromEnvironment();

const runShardPreflight = async (): Promise<number> => {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
  const databaseUrl = requiredEnv("E2E_DATABASE_URL");
  assertE2eRuntimeDestructiveTarget(
    "runtime-preflight-shard-launch",
    databaseUrl,
    process.env,
  );
  const launch = await preparePreflightShardLaunch({
    environment: process.env,
    repoRoot,
    validatedSource: sourceAuthority.source,
  });
  return runPreflightPlaywrightChild({
    repoRoot,
    environment: preflightShardChildEnvironment(process.env, launch),
  });
};

if (mode === "shard") {
  process.exitCode = await runShardPreflight();
} else {
  if (mode !== "canary" && mode !== "full" && mode !== "repair")
    throw new Error(
      "Runtime preflight launcher mode must be canary, full, or repair",
    );

  const launchMode: PreflightLaunchMode = mode === "full" ? "full" : "canary";
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
  const databaseUrl = requiredEnv("E2E_DATABASE_URL");
  assertE2eRuntimeDestructiveTarget(
    `runtime-preflight-${mode}-launch`,
    databaseUrl,
    process.env,
  );
  const archiveRoot = await ensurePreflightArchiveRoot(
    path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE")),
  );
  const selector =
    launchMode === "canary"
      ? preflightCanarySelectorFromEnvironment(process.env)
      : undefined;
  const fullLaunchCanaryConfiguration =
    process.env.RUNTIME_SWEEP_PREFLIGHT_REQUIRED_STATE_ID ??
    process.env.RUNTIME_SWEEP_CANARY_STATE_ID ??
    (process.env.RUNTIME_SWEEP_CANARY_SELECTOR === undefined
      ? undefined
      : "configured-selector");
  const stateId =
    launchMode === "canary" ? selector?.stateId : fullLaunchCanaryConfiguration;

  const assertArchiveOutput = (name: string, value: string): string => {
    const outputPath = path.resolve(value);
    const relative = path.relative(archiveRoot, outputPath);
    if (
      relative === "" ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    )
      throw new Error(`${name} must be a file below RUNTIME_SWEEP_ARCHIVE`);
    if (
      name === "RUNTIME_SWEEP_PREFLIGHT_CANARY" &&
      path.basename(outputPath) !== "PREFLIGHT_CANARY.json"
    )
      throw new Error(
        "RUNTIME_SWEEP_PREFLIGHT_CANARY must name PREFLIGHT_CANARY.json",
      );
    return outputPath;
  };

  const assertArchiveFile = async (
    name: string,
    value: string,
  ): Promise<string> => {
    const outputPath = assertArchiveOutput(name, value);
    await assertPreflightArchivePath(archiveRoot, outputPath);
    return outputPath;
  };

  await assertArchiveFile(
    "RUNTIME_SWEEP_SOURCE",
    requiredEnv("RUNTIME_SWEEP_SOURCE"),
  );
  const source = sourceAuthority.source;
  if (launchMode === "canary")
    await assertArchiveFile(
      "RUNTIME_SWEEP_PREFLIGHT_CANARY",
      requiredEnv("RUNTIME_SWEEP_PREFLIGHT_CANARY"),
    );

  const prepareFullPreflight = async (): Promise<PreflightFullPaths> => {
    const preflightPath = await assertArchiveFile(
      "RUNTIME_SWEEP_PREFLIGHT",
      requiredEnv("RUNTIME_SWEEP_PREFLIGHT"),
    );
    const assignmentPath = await assertArchiveFile(
      "RUNTIME_SWEEP_PREFLIGHT_ASSIGNMENT",
      process.env.RUNTIME_SWEEP_PREFLIGHT_ASSIGNMENT ??
        path.join(archiveRoot, "PREFLIGHT_ASSIGNMENT.json"),
    );
    const journalPath = await assertArchiveFile(
      "RUNTIME_SWEEP_PREFLIGHT_JOURNAL",
      process.env.RUNTIME_SWEEP_PREFLIGHT_JOURNAL ??
        path.join(archiveRoot, "PREFLIGHT.journal.jsonl"),
    );
    const segmentRoot = assertArchiveOutput(
      "RUNTIME_SWEEP_PREFLIGHT_SEGMENTS",
      process.env.RUNTIME_SWEEP_PREFLIGHT_SEGMENTS ??
        path.join(archiveRoot, "segments"),
    );
    return preparePreflightFullPaths({
      archiveRoot,
      source,
      preflightPath,
      assignmentPath,
      journalPath,
      segmentRoot,
    });
  };

  await assertPreflightLaunchGate({
    mode: launchMode,
    source,
    repoRoot,
    ...(process.env.RUNTIME_SWEEP_CAMPAIGN_KIND === undefined
      ? {}
      : { campaignKind: process.env.RUNTIME_SWEEP_CAMPAIGN_KIND }),
    ...(process.env.RUNTIME_SWEEP_PREFLIGHT_CANARY === undefined
      ? {}
      : { canaryPath: process.env.RUNTIME_SWEEP_PREFLIGHT_CANARY }),
    ...(stateId === undefined ? {} : { stateId }),
    ...(selector === undefined ? {} : { selector }),
    ...(process.env.RUNTIME_SWEEP_CANARY_SOURCE_SHA === undefined
      ? {}
      : { expectedSourceSha: process.env.RUNTIME_SWEEP_CANARY_SOURCE_SHA }),
  });

  const initialFullPreflight =
    mode === "full" ? await prepareFullPreflight() : undefined;
  const runPlaywright = (
    preflightMode: PreflightLaunchMode,
    fullPreflight?: PreflightFullPaths,
    extraEnvironment?: NodeJS.ProcessEnv,
  ): Promise<number> =>
    runPreflightPlaywrightChild({
      repoRoot,
      environment: {
        ...preflightChildEnvironment(process.env, preflightMode, fullPreflight),
        ...extraEnvironment,
      },
    });

  const runRevealCanary = (): Promise<number> => {
    if (selector === undefined)
      throw new Error(
        "Reveal continuation parent requires an exact canary selector",
      );
    return runExactAdminDemoRevealCanary({
      source,
      repoRoot,
      archiveRoot,
      canaryPath: assertArchiveOutput(
        "RUNTIME_SWEEP_PREFLIGHT_CANARY",
        requiredEnv("RUNTIME_SWEEP_PREFLIGHT_CANARY"),
      ),
      selector,
      hostCheckpointRoot: requiredEnv(
        "RUNTIME_SWEEP_PREFLIGHT_HOST_CHECKPOINT_ROOT",
      ),
      runPlaywright,
    });
  };

  if (mode === "canary") {
    process.exitCode = await runRevealCanary();
  } else if (mode === "full") {
    if (initialFullPreflight === undefined)
      throw new Error("Initial full preflight paths were not prepared");
    process.exitCode = await runPlaywright("full", initialFullPreflight);
  } else {
    const canaryPath = assertArchiveOutput(
      "RUNTIME_SWEEP_PREFLIGHT_CANARY",
      requiredEnv("RUNTIME_SWEEP_PREFLIGHT_CANARY"),
    );
    process.exitCode = await runPreflightRepairChain({
      runCanary: runRevealCanary,
      readCanary: () => readPreflightCanaryArtifact(canaryPath),
      assertCanary: (canary) => {
        assertPreflightCanaryPassForSource({
          source,
          canary,
          ...(selector === undefined ? {} : { stateId: selector.stateId }),
        });
      },
      recheckSource: async () => {
        await assertLivePreflightSourceIdentity({ source, repoRoot });
      },
      runFull: async () => runPlaywright("full", await prepareFullPreflight()),
    });
  }
}
