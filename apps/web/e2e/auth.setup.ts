import { test as setup, expect } from '@playwright/test';
import { resolve, dirname } from 'node:path';

const authDir = resolve(dirname(__filename), '.auth');

const WEB_URL = 'http://127.0.0.1:3100';
const roles = ['lead', 'head', 'viewer'] as const;

for (const role of roles) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    // dev-login is proxied through Next.js rewrites -> same-origin cookie
    await page.goto(`${WEB_URL}/auth/dev-login?role=${role}`);

    // After redirect, verify we landed on the app
    await expect(page).toHaveURL(new RegExp(`127\\.0\\.0\\.1:3100`));

    // Save storageState (cookies + localStorage) for this role
    await page.context().storageState({
      path: resolve(authDir, `${role}.json`),
    });
  });
}
