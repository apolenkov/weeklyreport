/**
 * Custom Playwright fixtures for CustomReport E2E tests.
 *
 * Extends the base test with role-specific page factories and
 * reusable helpers. Storage state will be loaded from the files
 * written by auth.setup.ts once real auth is wired.
 */

import { test as base, expect, type Page } from "@playwright/test";
import * as path from "path";

const AUTH_DIR = path.join(__dirname, ".auth");

// ---------------------------------------------------------------------------
// Helpers exposed as fixture methods
// ---------------------------------------------------------------------------

export async function waitForPageReady(page: Page) {
  // Wait for Next.js hydration -- the main content area must be present
  await page.waitForSelector("#main-content", {
    state: "visible",
    timeout: 15_000,
  });
}

export async function expectHeading(page: Page, text: string) {
  await expect(page.getByRole("heading", { name: text })).toBeVisible();
}

export async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await waitForPageReady(page);
}

// ---------------------------------------------------------------------------
// Role-scoped test fixtures
// ---------------------------------------------------------------------------

type Fixtures = {
  leadPage: Page;
  headPage: Page;
};

export const test = base.extend<Fixtures>({
  leadPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: path.join(AUTH_DIR, "lead.json"),
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  headPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: path.join(AUTH_DIR, "head.json"),
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

export { expect };
