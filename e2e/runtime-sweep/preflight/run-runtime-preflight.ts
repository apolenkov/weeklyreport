import { spawn } from "node:child_process";
import * as path from "node:path";

import { readSourceArtifact } from "../source/source-artifact.ts";
import {
  assertPreflightArchivePath,
  ensurePreflightArchiveRoot,
} from "./preflight-archive-path.ts";
import {
  assertLivePreflightSourceIdentity,
  assertPreflightCanaryPassForSource,
  preflightCanarySelectorFromEnvironment,
  readPreflightCanaryArtifact,
} from "./preflight-canary.ts";
import {
  assertPreflightLaunchGate,
  type PreflightLaunchMode,
} from "./preflight-launch-guard.ts";
import {
  preflightChildEnvironment,
  type PreflightFullPaths,
  preparePreflightFullPaths,
} from "./preflight-launcher-support.ts";
import { runPreflightRepairChain } from "./preflight-repair-chain.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime preflight launcher requires ${name}`);
  return value;
};

const pnpmLauncher = (): Readonly<{
  readonly command: string;
  readonly leadingArgs: readonly string[];
}> => {
  const executable = requiredEnv("npm_execpath");
  return /\.[cm]?js$/u.test(executable)
    ? { command: process.execPath, leadingArgs: [executable] }
    : { command: executable, leadingArgs: [] };
};

const mode = process.argv[2];
if (mode !== "canary" && mode !== "full" && mode !== "repair")
  throw new Error(
    "Runtime preflight launcher mode must be canary, full, or repair",
  );

const launchMode: PreflightLaunchMode = mode === "full" ? "full" : "canary";
const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
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

const sourcePath = await assertArchiveFile(
  "RUNTIME_SWEEP_SOURCE",
  requiredEnv("RUNTIME_SWEEP_SOURCE"),
);
const source = await readSourceArtifact(sourcePath);

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
const launchGateInput = {
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
} as const;
await assertPreflightLaunchGate(launchGateInput);
const initialFullPreflight =
  mode === "full" ? await prepareFullPreflight() : undefined;

const runPlaywright = (
  preflightMode: PreflightLaunchMode,
  fullPreflight?: PreflightFullPaths,
): Promise<number> => {
  const launcher = pnpmLauncher();
  const child = spawn(
    launcher.command,
    [
      ...launcher.leadingArgs,
      "--filter",
      "@customreport/web",
      "exec",
      "playwright",
      "test",
      "--config",
      "../../e2e/runtime-sweep/preflight/playwright.preflight.config.ts",
    ],
    {
      cwd: repoRoot,
      env: preflightChildEnvironment(process.env, preflightMode, fullPreflight),
      stdio: "inherit",
    },
  );
  return new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal !== null) {
        reject(new Error(`Runtime preflight terminated by signal ${signal}`));
        return;
      }
      resolve(code ?? 1);
    });
  });
};

if (mode === "canary") {
  process.exitCode = await runPlaywright("canary");
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
    runCanary: () => runPlaywright("canary"),
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
