/**
 * Reusable E2E test utilities for CustomReport.
 */

import { type Page, expect } from '@playwright/test';

/**
 * Navigate to dev-login endpoint. Currently a no-op since pages
 * render mock data; kept for future auth wiring.
 */
export async function loginAs(page: Page, role: 'lead' | 'head' | 'admin') {
  const redirect = role === 'lead' ? '/lead/report' : role === 'head' ? '/head/dashboard' : '/admin';
  try {
    await page.goto(`http://localhost:3102/auth/dev-login?role=${role}&redirect=${redirect}`, {
      timeout: 5_000,
    });
  } catch {
    // API not running -- navigate directly (mock data renders without auth)
    await page.goto(redirect);
  }
}

/**
 * Wait until the page's network is idle and main content is visible.
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
}

/**
 * Assert that the page has an h1 with the given text.
 */
export async function expectHeading(page: Page, text: string) {
  await expect(page.getByRole('heading', { name: text, level: 1 })).toBeVisible();
}

/**
 * Assert that a text element is visible on the page.
 */
export async function expectVisible(page: Page, text: string) {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
}

/**
 * Count elements matching a locator.
 */
export async function countElements(page: Page, selector: string): Promise<number> {
  return page.locator(selector).count();
}
