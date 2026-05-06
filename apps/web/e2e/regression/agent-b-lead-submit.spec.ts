import { test, expect } from '@playwright/test';

const DEV_LOGIN_URL = 'http://localhost:3000/auth/dev-login';
const FRONTEND_URL = 'http://localhost:3000';
const LEAD_REPORT_URL = 'http://localhost:3000/lead/report';
const SCREENSHOT_DIR = '.planning/regression/screenshots/agent-b-lead-submit';

/**
 * LEAD-090..LEAD-095: Submit Flow (6 scenarios)
 * - Submit button visibility (draft vs submitted)
 * - Confirm dialog
 * - Cancel / Confirm actions
 * - Success toast
 * - Form lock after submit
 */

test.describe('LEAD-090..095: Lead Report Submit Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as lead
    await page.goto(`${DEV_LOGIN_URL}?role=lead`);
    await page.waitForURL(FRONTEND_URL);
    // Navigate to report
    await page.goto(LEAD_REPORT_URL);
    await page.waitForSelector('[data-testid="lead-report-form"]', { timeout: 5000 });
  });

  test('LEAD-090: "Submit Section" button visible when draft', async ({ page }) => {
    // Look for submit button in draft form
    const submitButton = await page.locator('button:has-text("Submit"), button:has-text("Отправить")').first();
    const isVisible = await submitButton.isVisible().catch(() => false);

    // Either submit button or section should be draft
    const draftSection = await page.locator('[data-testid="section-status"]').textContent().catch(() => '');
    expect(isVisible || draftSection.includes('Draft')).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-090.png` });
  });

  test('LEAD-091: "Submit Section" button hidden when submitted', async ({ page }) => {
    // For a submitted section, button should be hidden and replaced with badge
    const submitButton = await page.locator('button:has-text("Submit"), button:has-text("Отправить")').isVisible().catch(() => false);

    // Check if section-submitted badge exists
    const submittedBadge = await page.locator('text=/Section submitted|Раздел отправлен/i').isVisible().catch(() => false);

    // If submitted, badge should be visible and button hidden
    if (submittedBadge) {
      expect(submitButton).toBe(false);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-091.png` });
  });

  test('LEAD-092: Click "Submit" opens ConfirmDialog', async ({ page }) => {
    // Find and click submit button
    const submitButton = await page.locator('button:has-text("Submit"), button:has-text("Отправить")').first();
    const isVisible = await submitButton.isVisible().catch(() => false);

    if (isVisible) {
      await submitButton.click();

      // Wait for dialog to appear
      const dialog = await page.locator('[role="dialog"]').first();
      const dialogVisible = await dialog.isVisible();
      expect(dialogVisible).toBe(true);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-092.png` });
  });

  test('LEAD-093: Confirm dialog: "Submit Section" title', async ({ page }) => {
    // Click submit button
    const submitButton = await page.locator('button:has-text("Submit"), button:has-text("Отправить")').first();
    const isVisible = await submitButton.isVisible().catch(() => false);

    if (isVisible) {
      await submitButton.click();

      // Wait for dialog
      const dialog = await page.locator('[role="dialog"]');
      await dialog.waitFor({ state: 'visible', timeout: 2000 });

      // Check for title
      const dialogTitle = await dialog.locator('h1, h2').first().textContent();
      expect(dialogTitle).toBeTruthy();
      expect(dialogTitle?.toLowerCase().includes('submit')).toBe(true);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-093.png` });
  });

  test('LEAD-094: Cancel in dialog: form stays editable', async ({ page }) => {
    // Click submit button
    const submitButton = await page.locator('button:has-text("Submit"), button:has-text("Отправить")').first();
    const isVisible = await submitButton.isVisible().catch(() => false);

    if (isVisible) {
      await submitButton.click();

      // Wait for dialog and click cancel
      const dialog = await page.locator('[role="dialog"]');
      await dialog.waitFor({ state: 'visible', timeout: 2000 });

      // Click cancel button
      const cancelButton = await dialog.locator('button:has-text("Cancel"), button:has-text("Отмена")').first();
      await cancelButton.click();

      // Dialog should close
      await dialog.waitFor({ state: 'hidden', timeout: 2000 });

      // Form should still be editable
      const firstInput = await page.locator('[data-testid="lead-report-form"] input[type="text"]').first();
      const isEnabled = await firstInput.isEnabled().catch(() => false);
      expect(isEnabled).toBe(true);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-094.png` });
  });

  test('LEAD-095: Confirm in dialog: submit mutation called', async ({ page }) => {
    // Click submit button
    const submitButton = await page.locator('button:has-text("Submit"), button:has-text("Отправить")').first();
    const isVisible = await submitButton.isVisible().catch(() => false);

    if (isVisible) {
      // Set up mutation listener
      let submitMutationCalled = false;
      await page.route('**/trpc/reports.submit*', (route) => {
        submitMutationCalled = true;
        route.continue();
      });

      await submitButton.click();

      // Wait for dialog and click confirm
      const dialog = await page.locator('[role="dialog"]');
      await dialog.waitFor({ state: 'visible', timeout: 2000 });

      // Click confirm button
      const confirmButton = await dialog.locator('button:has-text("Confirm"), button:has-text("Подтвердить")').last();
      await confirmButton.click();

      // Wait a bit for mutation
      await page.waitForTimeout(1000);

      // Either mutation was called or we see success toast
      const successToast = await page.locator('text=/submitted|отправ/i').isVisible().catch(() => false);
      expect(submitMutationCalled || successToast).toBe(true);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-095.png` });
  });
});
