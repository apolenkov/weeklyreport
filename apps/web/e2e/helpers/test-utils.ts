import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Wait for autosave indicator to show "Saved" / "Сохранено" state.
 * The AutosaveIndicator component cycles through Saving -> Saved.
 */
export async function waitForAutosave(page: Page): Promise<void> {
  await expect(
    page.getByText(/saved|Сохранено/i),
  ).toBeVisible({ timeout: 10_000 });
}

/**
 * Assert that a toast notification appeared (Sonner toast).
 * Matches partial text in the toast container.
 */
export async function expectToast(
  page: Page,
  text: string | RegExp,
): Promise<void> {
  const toastLocator = page
    .locator('[data-sonner-toast]')
    .filter({ hasText: text });
  await expect(toastLocator).toBeVisible({ timeout: 5_000 });
}

/**
 * Navigate as a specific role via the dev-login endpoint.
 * Auth setup creates storageState files, but this helper allows
 * quick role switching within a single test.
 */
export async function loginAs(
  page: Page,
  role: 'lead' | 'head' | 'viewer',
  apiUrl = 'http://127.0.0.1:3101',
): Promise<void> {
  await page.goto(`${apiUrl}/auth/dev-login?role=${role}`);
  await page.waitForURL(/localhost:3100/);
}

/**
 * Submit a lead section via the confirm dialog flow.
 * Clicks "Submit Section", waits for dialog, confirms.
 */
export async function submitSection(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Submit Section' }).click();
  await expect(
    page.getByRole('dialog').getByText('Submit Section'),
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Submit Section' })
    .click();
  await expect(page.getByText('Section submitted')).toBeVisible();
}

/**
 * Publish a report via the confirm dialog flow (head role).
 * Clicks "Publish Report", waits for dialog, confirms.
 */
export async function publishReport(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Publish Report' }).click();
  await expect(
    page.getByRole('dialog').getByText('Publish Report'),
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Publish' })
    .click();
  await expect(page.getByText('Report published')).toBeVisible();
}

/**
 * Assert that a date string is formatted in ru-RU locale (e.g. "6 апр. 2026 г.")
 * Looks for Cyrillic month abbreviations typical of ru-RU formatting.
 */
export async function expectRuLocaleDate(
  page: Page,
  containerSelector?: string,
): Promise<void> {
  const container = containerSelector
    ? page.locator(containerSelector)
    : page;
  // Russian locale months: янв., февр., мар., апр., мая, июн., июл., авг., сент., окт., нояб., дек.
  await expect(
    container.getByText(
      /(?:янв|февр|мар|апр|мая|июн|июл|авг|сент|окт|нояб|дек)/i,
    ),
  ).toBeVisible();
}
