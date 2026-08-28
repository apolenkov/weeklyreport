import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { setupE2eDatabase } from "../helpers/e2e-database-setup.ts";
import { resetE2eRedis } from "../helpers/e2e-redis-setup.ts";
import { waitForLoopbackPortsFree } from "./cleanup.ts";

const SOURCE_RECEIPT = "source.json";
const TEARDOWN_RECEIPT = "teardown.json";
const RESULT_RECEIPT = "acceptance-result.json";
const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const RUN_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const GIT_EXECUTABLE = "/usr/bin/git";

export interface SourceIdentity {
  readonly sha: string;
  readonly tree: string;
}

export interface SourceReceipt extends SourceIdentity {
  readonly recordedAt: string;
  readonly runId: string;
  readonly setupStatus: "PASS" | "FAIL" | "STARTED";
  readonly setupError?: string;
}

export interface TeardownReceipt {
  readonly cleanupError?: string;
  readonly cleanupStatus: "FAIL" | "PASS";
  readonly clients: string;
  readonly containers: string;
  readonly databaseState: "DETERMINISTIC_FULL_SEED" | "NOT_PROVEN";
  readonly listenersFree: boolean;
  readonly recordedAt: string;
  readonly redisState: "NOT_PROVEN" | "RESERVED_DB_15_EMPTY";
  readonly runId: string;
  readonly sourceUnchanged: boolean;
  readonly startedAt: string;
  readonly volumes: string;
}

export interface AcceptanceResult {
  readonly cleanupStatus: "PASS" | "FAIL_NOT_PROVEN";
  readonly overallStatus: "PASS" | "FAIL_NOT_PROVEN";
  readonly playwrightStatus: "passed" | "failed" | "timedout" | "interrupted";
}

interface LifecyclePaths {
  readonly result: string;
  readonly source: string;
  readonly teardown: string;
}

export const lifecyclePathsFor = (resultsRoot: string): LifecyclePaths => ({
  result: path.join(resultsRoot, RESULT_RECEIPT),
  source: path.join(resultsRoot, SOURCE_RECEIPT),
  teardown: path.join(resultsRoot, TEARDOWN_RECEIPT),
});

export const isRunId = (value: unknown): value is string =>
  typeof value === "string" && RUN_ID_PATTERN.test(value);

type GitValue = (args: readonly string[], repoRoot: string) => string;

const gitValue: GitValue = (args, repoRoot) =>
  execFileSync(GIT_EXECUTABLE, [...args], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();

export function sourceIdentityFor(
  repoRoot: string,
  runGit: GitValue = gitValue,
): SourceIdentity {
  const status = runGit(
    ["status", "--porcelain=v1", "--untracked-files=all"],
    repoRoot,
  );
  if (status !== "") {
    throw new Error(
      "WeeklyReport acceptance requires a clean source worktree.",
    );
  }
  const sha = runGit(["rev-parse", "--verify", "HEAD"], repoRoot);
  const tree = runGit(["rev-parse", "--verify", "HEAD^{tree}"], repoRoot);
  if (!SHA_PATTERN.test(sha) || !SHA_PATTERN.test(tree)) {
    throw new Error(
      "WeeklyReport acceptance could not resolve an exact SHA/tree.",
    );
  }
  return { sha, tree };
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export async function writeJson(
  filePath: string,
  value: unknown,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

interface SetupDependencies {
  readonly invalidatePriorRun: () => Promise<void>;
  readonly newRunId: () => string;
  readonly now: () => string;
  readonly readSource: () => SourceIdentity;
  readonly resetDatabase: () => void;
  readonly resetRedis: () => Promise<void>;
  readonly write: (receipt: SourceReceipt) => Promise<void>;
}

interface TeardownDependencies {
  readonly now: () => string;
  readonly readSource: () => SourceIdentity;
  readonly readSourceReceipt: () => Promise<SourceReceipt | undefined>;
  readonly resetDatabase: () => void;
  readonly resetRedis: () => Promise<void>;
  readonly verifyRuntimeStopped: () => Promise<boolean>;
  readonly write: (receipt: TeardownReceipt) => Promise<void>;
}

export async function runAcceptanceSetup(
  dependencies: SetupDependencies,
): Promise<SourceReceipt> {
  const source = dependencies.readSource();
  const runId = dependencies.newRunId();
  await dependencies.invalidatePriorRun();
  await dependencies.write({
    ...source,
    recordedAt: dependencies.now(),
    runId,
    setupStatus: "STARTED",
  });
  try {
    dependencies.resetDatabase();
    await dependencies.resetRedis();
    const afterSetup = dependencies.readSource();
    if (afterSetup.sha !== source.sha || afterSetup.tree !== source.tree) {
      throw new Error("WeeklyReport source identity changed during setup.");
    }
    const receipt = {
      ...source,
      recordedAt: dependencies.now(),
      runId,
      setupStatus: "PASS",
    } as const;
    await dependencies.write(receipt);
    return receipt;
  } catch (error: unknown) {
    await dependencies.write({
      ...source,
      recordedAt: dependencies.now(),
      runId,
      setupError: errorMessage(error),
      setupStatus: "FAIL",
    });
    throw error;
  }
}

export async function runDefaultAcceptanceSetup(
  repoRoot: string,
  resultsRoot: string,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<SourceReceipt> {
  const databaseUrl = environment.E2E_DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error("E2E_DATABASE_URL must be set for acceptance setup.");
  }
  const paths = lifecyclePathsFor(resultsRoot);
  return runAcceptanceSetup({
    invalidatePriorRun: async () => {
      await Promise.all([
        rm(paths.result, { force: true }),
        rm(paths.teardown, { force: true }),
      ]);
    },
    newRunId: randomUUID,
    now: () => new Date().toISOString(),
    readSource: () => sourceIdentityFor(repoRoot),
    resetDatabase: () =>
      setupE2eDatabase({
        databaseUrl,
        profile: "full",
        repoRoot,
      }),
    resetRedis: () =>
      resetE2eRedis({
        ...environment,
        E2E_DATABASE_URL: databaseUrl,
        E2E_REDIS_FLUSH: "true",
      }),
    write: (receipt) => writeJson(paths.source, receipt),
  });
}

export async function runAcceptanceTeardown(
  dependencies: TeardownDependencies,
): Promise<TeardownReceipt> {
  const startedAt = dependencies.now();
  const source = await dependencies.readSourceReceipt();
  try {
    if (source?.setupStatus !== "PASS") {
      throw new Error("Acceptance teardown requires a passing source receipt.");
    }
    if (!(await dependencies.verifyRuntimeStopped())) {
      throw new Error(
        "Acceptance teardown requires stopped runtime listeners.",
      );
    }
    dependencies.resetDatabase();
    await dependencies.resetRedis();
    const current = dependencies.readSource();
    if (source.sha !== current.sha || source.tree !== current.tree) {
      throw new Error("WeeklyReport source identity changed during teardown.");
    }
    const receipt = {
      cleanupStatus: "PASS",
      clients: "TRANSIENT_CLIENTS_CLOSED",
      containers: "NONE_CREATED",
      databaseState: "DETERMINISTIC_FULL_SEED",
      listenersFree: true,
      recordedAt: dependencies.now(),
      redisState: "RESERVED_DB_15_EMPTY",
      runId: source.runId,
      sourceUnchanged: true,
      startedAt,
      volumes: "NONE_CREATED",
    } as const;
    await dependencies.write(receipt);
    return receipt;
  } catch (error: unknown) {
    const receipt = {
      cleanupError: errorMessage(error),
      cleanupStatus: "FAIL",
      clients: "NOT_PROVEN",
      containers: "NONE_CREATED",
      databaseState: "NOT_PROVEN",
      listenersFree: false,
      recordedAt: dependencies.now(),
      redisState: "NOT_PROVEN",
      runId: source?.runId ?? "UNKNOWN",
      sourceUnchanged: false,
      startedAt,
      volumes: "NONE_CREATED",
    } as const;
    await dependencies.write(receipt);
    throw error;
  }
}

export async function runDefaultAcceptanceTeardown(
  repoRoot: string,
  resultsRoot: string,
  ownedPorts: readonly number[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<TeardownReceipt> {
  const databaseUrl = environment.E2E_DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error("E2E_DATABASE_URL must be set for acceptance teardown.");
  }
  const paths = lifecyclePathsFor(resultsRoot);
  return runAcceptanceTeardown({
    now: () => new Date().toISOString(),
    readSource: () => sourceIdentityFor(repoRoot),
    readSourceReceipt: () =>
      readJson<SourceReceipt>(paths.source).catch(() => undefined),
    resetDatabase: () =>
      setupE2eDatabase({
        databaseUrl,
        profile: "full",
        repoRoot,
      }),
    resetRedis: () =>
      resetE2eRedis({
        ...environment,
        E2E_DATABASE_URL: databaseUrl,
        E2E_REDIS_FLUSH: "true",
      }),
    verifyRuntimeStopped: () => waitForLoopbackPortsFree(ownedPorts),
    write: (receipt) => writeJson(paths.teardown, receipt),
  });
}

export function acceptanceResultFor(input: {
  readonly budgetValid: boolean;
  readonly listenersFree: boolean;
  readonly ownedFilesRemoved: boolean;
  readonly playwrightStatus: AcceptanceResult["playwrightStatus"];
  readonly setupStatus: SourceReceipt["setupStatus"] | "MISSING";
  readonly teardownValid: boolean;
}): AcceptanceResult {
  const cleanupStatus =
    input.listenersFree && input.ownedFilesRemoved && input.teardownValid
      ? "PASS"
      : "FAIL_NOT_PROVEN";
  return {
    cleanupStatus,
    overallStatus:
      input.playwrightStatus === "passed" &&
      input.setupStatus === "PASS" &&
      input.budgetValid &&
      cleanupStatus === "PASS"
        ? "PASS"
        : "FAIL_NOT_PROVEN",
    playwrightStatus: input.playwrightStatus,
  };
}
