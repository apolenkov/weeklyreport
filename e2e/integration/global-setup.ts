import { existsSync } from "node:fs";
import * as path from "node:path";

import {
  parseSeedProfile,
  type SeedProfile,
} from "../../prisma/seeds/profiles/seed-profile-contract.js";
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
    readonly E2E_SEED_PROFILE?: string;
  }> = process.env,
): SeedProfile {
  return parseSeedProfile(environment.E2E_SEED_PROFILE ?? "full");
}

/**
 * Runs ONCE before any integration test.
 *
 * - `prisma migrate reset --force` drops + recreates the guarded E2E schema
 * - the selected named profile is seeded and validated (`full` by default)
 *   against E2E_DATABASE_URL
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
  });
  await resetE2eRedis();
}
