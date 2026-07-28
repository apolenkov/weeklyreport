/**
 * Direct Prisma access for integration test assertions and per-test cleanup.
 *
 * Usage:
 *   import { prisma, resetMutations } from './helpers/db';
 *
 *   const section = await prisma.reportSection.findUnique({ where: { id } });
 *   expect(section?.status).toBe('submitted');
 *
 *   // After tests that mutate section/item/risk state:
 *   test.afterEach(async () => { await resetMutations(); });
 *
 * Connection: bound to E2E_DATABASE_URL (NEVER DATABASE_URL). The pg pool is
 * created once per worker; with workers:1 in the integration config that
 * means one shared pool for the whole run.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

const e2eUrl = process.env.E2E_DATABASE_URL;
if (!e2eUrl) {
  throw new Error(
    "helpers/db.ts: E2E_DATABASE_URL must be set (this should have been " +
      "guaranteed by playwright.integration.config.ts).",
  );
}

const pool = new pg.Pool({ connectionString: e2eUrl });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

/**
 * Re-run the canonical seed to restore mutable state to the seeded baseline.
 *
 * NOT a full migrate-reset — just `tsx prisma/seed.ts`. The seed is
 * idempotent (uses upsert by ID/email/composite-key), so it safely re-applies
 * baseline values on top of whatever the previous test left behind. New rows
 * created by tests (e.g., new Items, new Projects) are NOT deleted by this —
 * tests that create such rows must clean them up explicitly with `prisma`.
 *
 * Cost: ~1-3s per call. With workers:1 this is acceptable in `afterEach` for
 * specs that mutate seed entities.
 */
export async function resetMutations(): Promise<void> {
  const { execSync } = await import("node:child_process");
  const { findRepoRoot } = await import("../global-setup");
  const repoRoot = findRepoRoot(import.meta.dirname);
  execSync("pnpm exec prisma db seed", {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: e2eUrl },
    stdio: "pipe",
  });
}
