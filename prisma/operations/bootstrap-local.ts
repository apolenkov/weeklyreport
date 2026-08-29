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

export function runLocalBootstrap(
  profileValue: string | undefined,
  environment: LocalBootstrapEnvironment,
  spawn: LocalBootstrapSpawn = (command, args, options) =>
    spawnSync(command, [...args], options),
): void {
  const profile = parseSeedProfile(profileValue);
  const databaseUrl = requireValue(environment, "DATABASE_URL");
  const e2eDatabaseUrl = requireValue(environment, "E2E_DATABASE_URL");
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

  const steps = [
    [operation("./create-e2e-database.ts"), []],
    [operation("./migrate-deploy.ts"), []],
    [operation("../seeds/profiles/seed-profile.ts"), [profile]],
  ] as const;
  for (const [script, args] of steps) {
    const result = spawn(
      process.execPath,
      ["--import", "tsx", script, ...args],
      {
        cwd: REPO_ROOT,
        env: { ...environment },
        shell: false,
        stdio: "inherit",
      },
    );
    if (result.status !== 0) {
      throw new Error(
        `[bootstrap-local] ${script.split("/").at(-1) ?? "step"} failed with ` +
          `exit=${String(result.status)} signal=${String(result.signal)}.`,
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
