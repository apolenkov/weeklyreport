import { test as setup, expect } from '@playwright/test';
import { resolve, dirname } from 'node:path';

const authDir = resolve(dirname(__filename), '.auth');

const API_URL = 'http://127.0.0.1:3101';

const roles = ['lead', 'head', 'viewer'] as const;

for (const role of roles) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    // Hit the dev-login endpoint -- it creates user in DB and sets JWT cookie
    await page.goto(`${API_URL}/auth/dev-login?role=${role}`);

    // After redirect, verify cookie was set by checking we can access a page
    await expect(page).toHaveURL(/127\.0\.0\.1:3100/);

    // Save storageState (cookies + localStorage) for this role
    await page.context().storageState({
      path: resolve(authDir, `${role}.json`),
    });
  });
}
