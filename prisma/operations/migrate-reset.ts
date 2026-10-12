import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  assertE2eRuntimeDestructiveTarget,
  type DestructiveTargetEnv,
} from "../guards/_destructive-guard.js";
import { isEntrypoint } from "../guards/_entrypoint.js";
import { requireEnv } from "../guards/_require-env.js";

interface MigrateResetEnvironment
  extends DestructiveTargetEnv, NodeJS.ProcessEnv {
  readonly DATABASE_URL?: string;
}

interface SpawnResult {
  readonly status: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly error?: Error;
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
  const databaseUrl = requireEnv("DATABASE_URL", environment);
  assertE2eRuntimeDestructiveTarget("migrate-reset", databaseUrl, environment);
  let result: SpawnResult;
  try {
    result = spawn("pnpm", ["exec", "prisma", "migrate", "reset", "--force"], {
      cwd: path.resolve(import.meta.dirname, "../.."),
      env: { ...environment, DATABASE_URL: databaseUrl },
      shell: false,
      stdio: "inherit",
    });
  } catch (error) {
    throw new Error(`[migrate-reset] prisma migrate reset could not start`, {
      cause: error,
    });
  }
  const spawnDetail = result.error ? ` error=${result.error.message}` : "";
  if (result.error || result.status !== 0) {
    throw new Error(
      `[migrate-reset] prisma migrate reset failed with exit=${String(result.status)} signal=${String(result.signal)}${spawnDetail}`,
      { cause: result.error },
    );
  }
}

if (isEntrypoint(import.meta.url)) {
  runMigrateReset(process.env);
}
