/**
 * Direct Prisma access for integration test assertions and per-test cleanup,
 * bound to E2E_DATABASE_URL (never DATABASE_URL).
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

/** Re-runs the configured `full` profile to restore the seeded baseline. */
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
