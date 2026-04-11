import { test as base, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authDir = path.join(__dirname, '.auth');

type RoleFixtures = {
  leadPage: Page;
  headPage: Page;
  viewerPage: Page;
};

export const test = base.extend<RoleFixtures>({
  leadPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, 'lead.json'),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  headPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, 'head.json'),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  viewerPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, 'viewer.json'),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
