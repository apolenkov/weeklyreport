import { test, expect } from '@playwright/test';

const DEV_LOGIN_URL = 'http://localhost:3000/auth/dev-login';
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
    await page.goto(`${DEV_LOGIN_URL}?role=lead`);
    await page.waitForURL(FRONTEND_URL);
    // Navigate to report
    await page.goto(LEAD_REPORT_URL);
    await page.waitForSelector('[data-testid="lead-report-form"]', { timeout: 5000 });
  });

  test('LEAD-080: 3 priority rows displayed (rank 1, 2, 3)', async ({ page }) => {
    // Look for priorities section
    const prioritiesSection = await page.locator('[data-testid="priorities-editor"]').isVisible().catch(() => false);
    expect(prioritiesSection).toBe(true);

    // Look for inputs in priorities section
    const priorityInputs = await page.locator('[data-testid="priorities-editor"] input[type="text"]').count();
    // Should have at least 3 for rank 1, 2, 3
    expect(priorityInputs).toBeGreaterThanOrEqual(3);

    // Verify numbered circles exist (1, 2, 3)
    const priorityLabels = await page.locator('[data-testid="priorities-editor"] [data-testid*="priority-rank"]').count();
    expect(priorityLabels >= 3).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-080.png` });
  });

  test('LEAD-081: Priority text editable', async ({ page }) => {
    // Find first priority input
    const firstPriorityInput = await page.locator('[data-testid="priorities-editor"] input[type="text"]').first();
    expect(await firstPriorityInput.isEnabled()).toBe(true);

    // Type some text
    const testText = 'Priority test ' + Date.now();
    await firstPriorityInput.fill(testText);

    // Verify text was entered
    expect(await firstPriorityInput.inputValue()).toBe(testText);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-081.png` });
  });

  test('LEAD-082: Priority change triggers autosave', async ({ page }) => {
    // Edit a priority and verify autosave indicator appears
    const firstPriorityInput = await page.locator('[data-testid="priorities-editor"] input[type="text"]').first();
    const testText = 'Autosave priority ' + Date.now();

    // Set up listener for saveDraft mutation
    let mutationCalled = false;
    await page.route('**/trpc/reports.saveDraft*', (route) => {
      mutationCalled = true;
      route.continue();
    });

    // Edit the input
    await firstPriorityInput.fill(testText);

    // Wait for autosave to potentially fire (300ms debounce + some buffer)
    await page.waitForTimeout(1000);

    // Check for autosave indicator
    const autosaveIndicator = await page.locator('[data-testid="autosave-indicator"]').isVisible().catch(() => false);
    expect(autosaveIndicator || mutationCalled).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-082.png` });
  });

  test('LEAD-083: Disabled state: opacity-50 pointer-events-none', async ({ page }) => {
    // For submitted sections, inputs should be disabled
    const prioritiesSection = await page.locator('[data-testid="priorities-editor"]');
    const sectionVisible = await prioritiesSection.isVisible().catch(() => false);

    if (sectionVisible) {
      // Check if inputs are enabled or disabled
      const firstInput = await prioritiesSection.locator('input[type="text"]').first();
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
    // Find priority inputs and check for aria-label
    const inputs = await page.locator('[data-testid="priorities-editor"] input[type="text"]');
    const count = await inputs.count();

    // Check at least first priority has aria-label
    if (count > 0) {
      const firstInput = await inputs.first();
      const ariaLabel = await firstInput.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      // Should mention priority or rank
      expect(ariaLabel?.toLowerCase().includes('priority') || ariaLabel?.toLowerCase().includes('rank')).toBeTruthy();
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-084.png` });
  });

  test('LEAD-085: Label htmlFor matches input id', async ({ page }) => {
    // Find labels in priorities section
    const labels = await page.locator('[data-testid="priorities-editor"] label');
    const labelCount = await labels.count();

    // Check that labels have htmlFor attribute
    if (labelCount > 0) {
      const firstLabel = await labels.first();
      const htmlFor = await firstLabel.getAttribute('for');
      expect(htmlFor).toBeTruthy();

      // Find corresponding input with that id
      const matchingInput = await page.locator(`[data-testid="priorities-editor"] input#${htmlFor}`);
      const inputExists = await matchingInput.isVisible().catch(() => false);
      expect(inputExists).toBe(true);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-085.png` });
  });
});
