import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  assertE2eRuntimeDestructive,
  type DestructiveTargetEnv,
} from "../guards/_destructive-guard.js";
import { isEntrypoint } from "../guards/_entrypoint.js";
import { requireEnv } from "../guards/_require-env.js";

interface SpawnResult {
  readonly status: number | null;
  readonly signal: NodeJS.Signals | null;
}

type MigrateDeploySpawn = (
  command: string,
  args: readonly string[],
  options: {
    readonly cwd: string;
    readonly env: NodeJS.ProcessEnv;
    readonly shell: false;
    readonly stdio: "inherit";
  },
) => SpawnResult;

/** Run Prisma migrate deploy only after the exact disposable guard passes. */
export function runMigrateDeploy(
  environment: DestructiveTargetEnv,
  spawn: MigrateDeploySpawn = spawnSync,
): void {
  const childEnvironment = {
    ...process.env,
    ...environment,
  };
  // These safety inputs must remain explicit even when ambient values exist.
  if (environment.DATABASE_URL === undefined)
    delete childEnvironment.DATABASE_URL;
  if (environment.PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION === undefined)
    delete childEnvironment.PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION;
  assertE2eRuntimeDestructive("migrate-deploy", childEnvironment);
  const repoRoot = path.resolve(import.meta.dirname, "../..");
  const result = spawn("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: repoRoot,
    env: childEnvironment,
    shell: false,
    stdio: "inherit",
  });
  if (result.status !== 0)
    throw new Error(
      `prisma migrate deploy failed with exit code ${result.status ?? "unknown"}`,
    );
}

if (isEntrypoint(import.meta.url)) {
  runMigrateDeploy({
    ...process.env,
    DATABASE_URL: requireEnv("DATABASE_URL"),
  });
}
