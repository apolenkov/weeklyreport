import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  assertE2eRuntimeDestructiveTarget,
  type DestructiveTargetEnv,
} from "../guards/_destructive-guard.js";
import { isEntrypoint } from "../guards/_entrypoint.js";
import { requireEnv } from "../guards/_require-env.js";

interface MigrateResetEnvironment extends DestructiveTargetEnv {
  readonly DATABASE_URL?: string;
}

interface SpawnResult {
  readonly status: number | null;
  readonly signal: NodeJS.Signals | null;
}

type Spawn = (
  command: string,
  args: readonly string[],
  options: {
    readonly cwd: string;
    readonly env: NodeJS.ProcessEnv;
    readonly shell: false;
    readonly stdio: "inherit";
  },
) => SpawnResult;

/** Run Prisma migrate reset only after the exact disposable guard passes. */
export function runMigrateReset(
  environment: MigrateResetEnvironment = process.env,
  spawn: Spawn = (command, args, options) =>
    spawnSync(command, [...args], options),
): void {
  const databaseUrl = requireEnvFrom(environment, "DATABASE_URL");
  assertE2eRuntimeDestructiveTarget("migrate-reset", databaseUrl, environment);
  const result = spawn(
    "pnpm",
    ["exec", "prisma", "migrate", "reset", "--force"],
    {
      cwd: path.resolve(import.meta.dirname, "../.."),
      env: { ...environment, DATABASE_URL: databaseUrl },
      shell: false,
      stdio: "inherit",
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `[migrate-reset] prisma migrate reset failed with ` +
        `exit=${String(result.status)} signal=${String(result.signal)}`,
    );
  }
}

const requireEnvFrom = (
  environment: MigrateResetEnvironment,
  key: "DATABASE_URL",
): string => {
  const value = environment[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

if (isEntrypoint(import.meta.url)) {
  runMigrateReset({
    ...process.env,
    DATABASE_URL: requireEnv("DATABASE_URL"),
  });
}
