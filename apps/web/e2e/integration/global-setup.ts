import { execSync } from 'node:child_process';
import * as path from 'node:path';

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
  if (!dbUrl) throw new Error('E2E_DATABASE_URL not set');

  // apps/web/e2e/integration/global-setup.ts -> repo root is 4 dirs up.
  const repoRoot = path.resolve(__dirname, '../../../..');

  // Prisma 7 dropped `--skip-seed` and runs the seed registered in
  // prisma.config.ts (`migrations.seed`) automatically after `migrate reset`.
  // The single command below resets schema, applies migrations, AND seeds.
  console.log('[e2e] Resetting + seeding integration database...');
  execSync('pnpm exec prisma migrate reset --force', {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'inherit',
  });

  console.log('[e2e] Database ready.');
}
