/**
 * Authenticate against /auth/dev-login once per role and persist the
 * resulting cookie to e2e/.auth/<role>.json. Specs that depend on
 * `setup` reuse the storage state, so each test starts authenticated
 * without re-running the dev-login round-trip.
 *
 * Requires AUTH_DEV_MODE=true on the API process — playwright.config.ts
 * webServer block sets that env var explicitly.
 */

import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_DIR = path.join(__dirname, '.auth');

const ROLES: { role: 'lead' | 'head' | 'admin' | 'viewer'; email: string }[] = [
  { role: 'lead', email: 'polenkov@customreport.local' },
  { role: 'head', email: 'head@customreport.local' },
  { role: 'admin', email: 'admin@customreport.local' },
  { role: 'viewer', email: 'viewer@customreport.local' },
];

setup.beforeAll(() => {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
});

for (const { role, email } of ROLES) {
  setup(`authenticate ${role}`, async ({ page, context }) => {
    const params = new URLSearchParams({ role, email, next: '/' });
    await page.goto(`/auth/dev-login?${params.toString()}`);
    // dev-login redirects to next= path; wait until URL is no longer the
    // login endpoint so Set-Cookie has been processed.
    await page.waitForURL((url) => !url.pathname.startsWith('/auth/dev-login'), {
      timeout: 10_000,
    });
    const target = path.join(STORAGE_DIR, `${role}.json`);
    await context.storageState({ path: target });
  });
}
