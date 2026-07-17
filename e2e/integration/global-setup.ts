import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import * as path from "node:path";

/**
 * Walks up from `startDir` looking for the nearest ancestor containing a
 * `package.json`. Scoped to this file only — not a general workspace-root
 * finder — because the hardcoded `../../../..` this replaces went stale
 * silently when the e2e suite moved and its distance to the repo root
 * changed; a walk-up survives future moves without a matching edit here.
 */
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

/**
 * Runs ONCE before any integration test.
 *
 * - `prisma migrate reset --force --skip-seed` drops + recreates schema, no auto-seed
 * - then `tsx prisma/seed.ts` runs the canonical seed against E2E_DATABASE_URL
 *
 * MUST run against E2E_DATABASE_URL — never the dev DATABASE_URL. The
 * playwright.integration.config.ts already throws if E2E_DATABASE_URL is unset,
 * so by the time we get here it is guaranteed defined.
 */
export default async function globalSetup(): Promise<void> {
  const dbUrl = process.env.E2E_DATABASE_URL;
  if (!dbUrl) throw new Error("E2E_DATABASE_URL not set");

  const repoRoot = findRepoRoot(__dirname);

  // Prisma 7 + prisma.config.ts: `migrate reset` does NOT auto-invoke the
  // `migrations.seed` command despite the docs implying otherwise. Empirically
  // verified at this commit — running `prisma migrate reset --force` against
  // an empty e2e DB leaves it with 0 rows. We therefore chain an explicit
  // `prisma db seed` after the reset. Without this, dev-login spawns
  // ad-hoc users/reports on demand, polluting the DB and causing
  // `prisma.reportSection.update()` calls in cross-role specs to miss the
  // seeded composite key. This was the root cause of multiple Phase 27
  // integration failures attributed (incorrectly) to per-spec bugs.
  console.log("[e2e] Resetting integration database...");
  execSync("pnpm exec prisma migrate reset --force", {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "inherit",
  });

  console.log("[e2e] Seeding integration database...");
  execSync("pnpm exec prisma db seed", {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "inherit",
  });

  console.log("[e2e] Database ready.");
}
