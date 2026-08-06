import { existsSync } from "node:fs";
import * as path from "node:path";

import {
  parseSeedProfile,
  type SeedProfile,
} from "../../prisma/seeds/profiles/seed-profile-contract.js";
import type { E2eDatabaseSetupMode } from "../helpers/e2e-database-setup.js";
import { setupE2eDatabase } from "../helpers/e2e-database-setup.js";
import { resetE2eRedis } from "../helpers/e2e-redis-setup.js";

export function findRepoRoot(startDir: string): string {
  if (existsSync(path.join(startDir, "package.json"))) return startDir;

  const parent = path.dirname(startDir);
  if (parent === startDir) {
    throw new Error(
      `Could not locate repo root: no ancestor of ${startDir} contains a package.json`,
    );
  }
  return findRepoRoot(parent);
}

export function selectedSeedProfile(
  environment: Readonly<{
    readonly RUNTIME_SWEEP_PROFILE?: string;
    readonly E2E_SEED_PROFILE?: string;
  }> = process.env,
): SeedProfile {
  const runtimeProfile = environment.RUNTIME_SWEEP_PROFILE;
  const integrationProfile = environment.E2E_SEED_PROFILE;
  if (
    runtimeProfile !== undefined &&
    integrationProfile !== undefined &&
    runtimeProfile !== integrationProfile
  ) {
    throw new Error(
      `RUNTIME_SWEEP_PROFILE (${runtimeProfile}) must match E2E_SEED_PROFILE (${integrationProfile})`,
    );
  }
  return parseSeedProfile(runtimeProfile ?? integrationProfile ?? "full");
}

export function runtimeDatabaseSetupMode(
  environment: Readonly<{
    readonly RUNTIME_SWEEP_REUSE_DATABASE?: string;
  }> = process.env,
): E2eDatabaseSetupMode {
  const value = environment.RUNTIME_SWEEP_REUSE_DATABASE;
  if (value === undefined || value === "false") return "schema+seed";
  if (value === "true") return "profile-reseed";
  throw new Error("RUNTIME_SWEEP_REUSE_DATABASE must be true or false");
}

/**
 * Runs ONCE before any integration test.
 *
 * - `prisma migrate reset --force` drops + recreates the guarded E2E schema
 * - the selected named profile is seeded and validated (`full` by default)
 *   against E2E_DATABASE_URL
 * - runtime diagnostics may set `RUNTIME_SWEEP_REUSE_DATABASE=true` to keep
 *   the schema and perform only the deterministic profile reseed
 *
 * MUST run against E2E_DATABASE_URL — never the dev DATABASE_URL. The
 * playwright.integration.config.ts already throws if E2E_DATABASE_URL is unset,
 * so by the time we get here it is guaranteed defined.
 */
export default async function globalSetup(): Promise<void> {
  const dbUrl = process.env.E2E_DATABASE_URL;
  if (!dbUrl) throw new Error("E2E_DATABASE_URL not set");

  const repoRoot = findRepoRoot(import.meta.dirname);
  const profile = selectedSeedProfile();
  setupE2eDatabase({
    databaseUrl: dbUrl,
    profile,
    repoRoot,
    mode: runtimeDatabaseSetupMode(),
  });
  await resetE2eRedis();
}
