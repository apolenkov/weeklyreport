import { test as base, expect, type Page } from '@playwright/test';
import { resolve, join, dirname } from 'node:path';

const authDir = resolve(dirname(__filename), '.auth');

type RoleFixtures = {
  leadPage: Page;
  headPage: Page;
  viewerPage: Page;
};

export const test = base.extend<RoleFixtures>({
  leadPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: join(authDir, 'lead.json'),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  headPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: join(authDir, 'head.json'),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  viewerPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: join(authDir, 'viewer.json'),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
