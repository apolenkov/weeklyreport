import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { config as loadEnvironment } from "dotenv";

import {
  assertE2eRuntimeDestructiveTarget,
  type DestructiveTargetEnv,
  E2E_DATABASE_NAME,
  parseE2eRuntimeDatabaseTarget,
  sameLocalPostgresDatabaseTarget,
} from "../guards/_destructive-guard.js";
import { isEntrypoint } from "../guards/_entrypoint.js";
import { parseSeedProfile } from "../seeds/profiles/seed-profile-contract.js";

interface LocalBootstrapEnvironment extends DestructiveTargetEnv {
  readonly E2E_DATABASE_URL?: string;
}

interface SpawnResult {
  readonly status: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly error?: Error;
}

export type LocalBootstrapSpawn = (
  command: string,
  args: readonly string[],
  options: {
    readonly cwd: string;
    readonly env: NodeJS.ProcessEnv;
    readonly shell: false;
    readonly stdio: "inherit";
  },
) => SpawnResult;

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const operation = (path: string): string =>
  fileURLToPath(new URL(path, import.meta.url));

const requireValue = (
  environment: LocalBootstrapEnvironment,
  key: "DATABASE_URL" | "E2E_DATABASE_URL",
): string => {
  const value = environment[key];
  if (!value) throw new Error(`[bootstrap-local] ${key} must be set.`);
  return value;
};

function assertGuardedTargets(
  databaseUrl: string,
  e2eDatabaseUrl: string,
  environment: LocalBootstrapEnvironment,
): void {
  assertE2eRuntimeDestructiveTarget(
    "bootstrap-local:application",
    databaseUrl,
    environment,
  );
  assertE2eRuntimeDestructiveTarget(
    "bootstrap-local:create",
    e2eDatabaseUrl,
    environment,
  );
  const identity = parseE2eRuntimeDatabaseTarget(
    "bootstrap-local:create",
    e2eDatabaseUrl,
  );
  if (identity.database !== E2E_DATABASE_NAME) {
    throw new Error(
      `[bootstrap-local] E2E_DATABASE_URL must name ${E2E_DATABASE_NAME}.`,
    );
  }
  if (
    !sameLocalPostgresDatabaseTarget(
      "bootstrap-local",
      databaseUrl,
      e2eDatabaseUrl,
    )
  ) {
    throw new Error(
      "[bootstrap-local] DATABASE_URL and E2E_DATABASE_URL must identify the same guarded local database.",
    );
  }
}

export function runLocalBootstrap(
  profileValue: string | undefined,
  environment: LocalBootstrapEnvironment,
  spawn: LocalBootstrapSpawn = (command, args, options) =>
    spawnSync(command, [...args], options),
): void {
  const profile = parseSeedProfile(profileValue);
  const databaseUrl = requireValue(environment, "DATABASE_URL");
  const e2eDatabaseUrl = requireValue(environment, "E2E_DATABASE_URL");
  assertGuardedTargets(databaseUrl, e2eDatabaseUrl, environment);

  const steps = [
    {
      command: "pnpm",
      args: ["--filter", "@customreport/api", "db:generate"],
      label: "db:generate",
    },
    {
      command: process.execPath,
      args: ["--import", "tsx", operation("./create-e2e-database.ts")],
      label: "create-e2e-database.ts",
    },
    {
      command: process.execPath,
      args: ["--import", "tsx", operation("./migrate-deploy.ts")],
      label: "migrate-deploy.ts",
    },
    {
      command: process.execPath,
      args: [
        "--import",
        "tsx",
        operation("../seeds/profiles/seed-profile.ts"),
        profile,
      ],
      label: "seed-profile.ts",
    },
  ] as const;
  for (const step of steps) {
    let result: SpawnResult;
    try {
      result = spawn(step.command, step.args, {
        cwd: REPO_ROOT,
        env: { ...environment },
        shell: false,
        stdio: "inherit",
      });
    } catch (error) {
      throw new Error(`[bootstrap-local] ${step.label} could not start`, {
        cause: error,
      });
    }
    const spawnDetail = result.error ? ` error=${result.error.message}` : "";
    if (result.error || result.status !== 0) {
      throw new Error(
        `[bootstrap-local] ${step.label} failed with exit=${String(result.status)} signal=${String(result.signal)}${spawnDetail}`,
        { cause: result.error },
      );
    }
  }
}

if (isEntrypoint(import.meta.url)) {
  loadEnvironment({ path: `${REPO_ROOT}.env`, override: false });
  try {
    runLocalBootstrap(process.argv[2], process.env);
  } catch (error: unknown) {
    console.error("[bootstrap-local] Failed:", error);
    process.exitCode = 1;
  }
}
