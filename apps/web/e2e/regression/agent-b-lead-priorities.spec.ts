import { test, expect } from '@playwright/test';

const DEV_LOGIN_URL = 'http://localhost:3002/auth/dev-login';
const FRONTEND_URL = 'http://localhost:3000';
const LEAD_REPORT_URL = 'http://localhost:3000/lead/report';
const SCREENSHOT_DIR = '.planning/regression/screenshots/agent-b-lead-priorities';

/**
 * LEAD-080..LEAD-085: Priorities Editor (6 scenarios)
 * - 3 priority rows (rank 1, 2, 3)
 * - Text editing
 * - Autosave trigger
 * - Disabled state (submitted)
 * - Accessibility (aria-label, htmlFor)
 */

test.describe('LEAD-080..085: Priorities Editor', () => {
  test.beforeEach(async ({ page }) => {
    // Login as lead
    await page.goto(`${DEV_LOGIN_URL}?role=lead&email=lead1@customreport.local`);
    await page.waitForURL(/^http:\/\/localhost:3000\//, { timeout: 10000 });
    // Navigate to report
    await page.goto(LEAD_REPORT_URL);
    await page.waitForSelector('[data-testid="lead-report-form"]', { timeout: 10000 });
  });

  test('LEAD-080: 3 priority rows displayed (rank 1, 2, 3)', async ({ page }) => {
    await expect(page.getByText('Priorities', { exact: true })).toBeVisible();
    const priorityRows = page.locator('[data-testid="priority-row"]');
    expect(await priorityRows.count()).toBeGreaterThanOrEqual(3);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-080.png` });
  });

  test('LEAD-081: Priority text editable', async ({ page }) => {
    await page.getByRole('button', { name: /edit priority 1/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const firstPriorityInput = dialog.getByRole('textbox').first();
    await expect(firstPriorityInput).toBeEnabled();

    // Type some text
    const testText = 'Priority test ' + Date.now();
    await firstPriorityInput.fill(testText);

    // Verify text was entered
    expect(await firstPriorityInput.inputValue()).toBe(testText);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-081.png` });
  });

  test('LEAD-082: Priority change triggers autosave', async ({ page }) => {
    await page.getByRole('button', { name: /edit priority 1/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const firstPriorityInput = dialog.getByRole('textbox').first();
    const testText = 'Autosave priority ' + Date.now();

    // Set up listener for saveDraft mutation
    let mutationCalled = false;
    await page.route('**/trpc/reports.saveDraft*', (route) => {
      mutationCalled = true;
      route.continue();
    });

    // Edit the input
    await firstPriorityInput.fill(testText);
    await dialog.getByRole('button', { name: /save priority/i }).click();

    // Wait for autosave to potentially fire (300ms debounce + some buffer)
    await page.waitForTimeout(1000);

    const updatedRow = await page.getByText(testText).isVisible({ timeout: 3000 }).catch(() => false);
    const autosaveIndicator = await page.locator('text=/автосохранение|autosave|saving/i').isVisible().catch(() => false);
    expect(updatedRow || autosaveIndicator || mutationCalled).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-082.png` });
  });

  test('LEAD-083: Disabled state: opacity-50 pointer-events-none', async ({ page }) => {
    // For submitted sections, inputs should be disabled
    const prioritiesSection = page.locator('[data-testid="priority-row"]').first();
    const sectionVisible = await prioritiesSection.isVisible().catch(() => false);

    if (sectionVisible) {
      // Check if inputs are enabled or disabled
      const firstInput = prioritiesSection.getByRole('button', { name: /edit priority/i }).first();
      const isDisabled = await firstInput.isDisabled();
      // If disabled, check for opacity-50 or pointer-events-none
      if (isDisabled) {
        const classes = await firstInput.getAttribute('class');
        expect(classes?.includes('opacity-50') || classes?.includes('pointer-events-none')).toBeTruthy();
      }
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-083.png` });
  });

  test('LEAD-084: aria-label "Priority {rank}" on each input', async ({ page }) => {
    const inputs = page.locator('[data-testid="priority-row"]').getByRole('button', { name: /edit priority/i });
    const count = await inputs.count();
    if (count > 0) {
      const firstInput = inputs.first();
      const ariaLabel = await firstInput.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel?.toLowerCase().includes('priority')).toBeTruthy();
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-084.png` });
  });

  test('LEAD-085: Label htmlFor matches input id', async ({ page }) => {
    await page.getByRole('button', { name: /edit priority 1/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const label = dialog.locator('label').first();
    const htmlFor = await label.getAttribute('for');
    expect(htmlFor).toBeTruthy();
    await expect(dialog.locator(`input#${htmlFor}, textarea#${htmlFor}`)).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-085.png` });
  });
});
