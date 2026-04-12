import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Wait for autosave indicator to show saved state.
 * The AutosaveIndicator component shows "Section submitted" when submitted,
 * or "Saved" / "All changes saved" when draft autosave completes.
 */
export async function waitForAutosave(page: Page): Promise<void> {
  await expect(
    page.getByText(/saved|section submitted/i),
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
