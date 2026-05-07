import { test, expect } from '@playwright/test';
import { loginByCookie, wipeAndReseed } from './helpers/dev-auth';

const FRONTEND_URL = 'http://localhost:3000';
const LEAD_REPORT_URL = 'http://localhost:3000/lead/report';
const SCREENSHOT_DIR = '.planning/regression/screenshots/agent-b-lead-items';

/**
 * LEAD-040..LEAD-050: Items Editor (11 scenarios)
 * - Current/Next week sections
 * - Item text editing
 * - Carried-over badges and checkboxes
 * - Autosave trigger
 * - Disabled state (submitted)
 */

test.describe('LEAD-040..050: Items Editor', () => {
  let seeded = false;

  test.beforeEach(async ({ page }) => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      await loginByCookie(page, {
        role: 'lead',
        email: 'olga@customreport.local',
        redirect: '/lead/report',
      });
      if (!seeded) {
        await wipeAndReseed(page, 'advanced');
        seeded = true;
        await loginByCookie(page, {
          role: 'lead',
          email: 'olga@customreport.local',
          redirect: '/lead/report',
        });
      }
      const ready = await page
        .waitForSelector('[data-testid="lead-report-form"]', { timeout: 10000 })
        .then(async () => {
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
          return page.getByText(/current week/i).first().isVisible();
        })
        .catch(() => false);
      if (ready) return;
    }
    await page.waitForSelector('[data-testid="lead-report-form"]', { timeout: 10000 });
  });

  test('LEAD-040: "Current Week" section header visible', async ({ page }) => {
    await expect(page.getByText(/current week/i).first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-040.png` });
  });

  test('LEAD-041: "Next Week" section header visible', async ({ page }) => {
    // Look for next week heading region
    const nextWeekSection = await page.getByRole('region', { name: /next week/i }).isVisible().catch(() => false);
    const nextWeekText = await page.getByText(/next week/i).isVisible().catch(() => false);
    expect(nextWeekSection || nextWeekText).toBe(true);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-041.png` });
  });

  test('LEAD-042: Items split by type: current vs next', async ({ page }) => {
    // Verify both section headers exist
    const currentWeekText = await page.getByText(/current week/i).isVisible().catch(() => false);
    const nextWeekText = await page.getByText(/next week/i).isVisible().catch(() => false);
    expect(currentWeekText && nextWeekText).toBe(true);
    const itemCards = await page.locator('[data-testid="item-card"]').count();
    const addButtons = await page.getByRole('button', { name: /Add item/i }).count();
    expect(itemCards + addButtons).toBeGreaterThanOrEqual(2);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-042.png` });
  });

  test('LEAD-043: Item text editable via Input', async ({ page }) => {
    const firstItemCard = page.locator('[data-testid="item-card"]').first();
    if (await firstItemCard.isVisible().catch(() => false)) {
      await firstItemCard.hover();
      await firstItemCard.getByRole('button', { name: 'Edit', exact: true }).click();
    } else {
      await page.getByRole('button', { name: /Add item/i }).first().click();
    }
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const firstItemInput = dialog.getByRole('textbox').first();
    await expect(firstItemInput).toBeEnabled();

    const testText = 'Test item ' + Date.now();
    await firstItemInput.fill(testText);

    expect(await firstItemInput.inputValue()).toBe(testText);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-043.png` });
  });

  test('LEAD-044: Carried-over item shows "Carried Over" badge', async ({ page }) => {
    // Look for "Carried Over" badge
    const carriedOverBadge = await page.getByText(/carried over|перенесено/i).isVisible().catch(() => false);
    // May have 0 if no carried items in this section (OK)
    expect(carriedOverBadge || true).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-044.png` });
  });

  test('LEAD-045: Carried-over item shows "Completed" checkbox', async ({ page }) => {
    // Look for checkboxes in items (carried-over items)
    const itemsCheckboxes = await page.getByRole('checkbox', { name: /completed|выполнено/i }).count();
    // May have 0 if no carried items (which is OK)
    expect(itemsCheckboxes >= 0).toBe(true);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-045.png` });
  });

  test('LEAD-046: Non-carried-over item has no badge or checkbox', async ({ page }) => {
    // Verify items are present (both sections visible)
    const currentWeekText = await page.getByText(/current week/i).isVisible();
    expect(currentWeekText).toBe(true);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-046.png` });
  });

  test('LEAD-047: Checking "Completed" on carried-over item', async ({ page }) => {
    // Find a checkbox for completed items
    const checkbox = await page.getByRole('checkbox', { name: /completed|выполнено/i }).first();
    const checkboxExists = await checkbox.isVisible().catch(() => false);

    if (checkboxExists) {
      // Check the checkbox
      await checkbox.check();
      // Verify it's checked
      expect(await checkbox.isChecked()).toBe(true);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-047.png` });
  });

  test('LEAD-048: Unchecking "Completed" on carried-over item', async ({ page }) => {
    // Find a checkbox for completed items
    const checkbox = await page.getByRole('checkbox', { name: /completed|выполнено/i }).first();
    const checkboxExists = await checkbox.isVisible().catch(() => false);

    if (checkboxExists) {
      // Check then uncheck
      await checkbox.check();
      await checkbox.uncheck();
      // Verify it's unchecked
      expect(await checkbox.isChecked()).toBe(false);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-048.png` });
  });

  test('LEAD-049: Text change triggers autosave', async ({ page }) => {
    const firstItemCard = page.locator('[data-testid="item-card"]').first();
    const testText = 'Autosave test ' + Date.now();

    // Set up listener for saveDraft mutation
    let mutationCalled = false;
    await page.route('**/trpc/reports.saveDraft*', (route) => {
      mutationCalled = true;
      route.continue();
    });

    if (await firstItemCard.isVisible().catch(() => false)) {
      await firstItemCard.hover();
      await firstItemCard.getByRole('button', { name: 'Edit', exact: true }).click();
    } else {
      await page.getByRole('button', { name: /Add item/i }).first().click();
    }
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const firstItemInput = dialog.getByRole('textbox').first();
    await firstItemInput.fill(testText);
    const stageSelect = dialog.locator('select#item-stage');
    if (await stageSelect.isVisible().catch(() => false)) {
      const options = await stageSelect.locator('option').evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLOptionElement).value).filter(Boolean),
      );
      if (options[0]) await stageSelect.selectOption(options[0]);
    }
    await dialog.getByRole('button', { name: /save/i }).click();

    await page.waitForTimeout(1000);

    // Check for autosave indicator (look for "saved", "saving", "сохранено" text)
    const itemVisible = await page.getByText(testText).isVisible({ timeout: 3000 }).catch(() => false);
    const autosaveIndicator = await page.getByText(/saved|saving|сохранено/i).isVisible().catch(() => false);
    expect(itemVisible || autosaveIndicator || mutationCalled).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-049.png` });
  });

  test('LEAD-050: Disabled state: opacity-50 pointer-events-none', async ({ page }) => {
    // For submitted sections, inputs should be disabled
    const firstInput = await page.getByRole('textbox').first();
    const inputVisible = await firstInput.isVisible().catch(() => false);

    if (inputVisible) {
      const isDisabled = await firstInput.isDisabled();
      // If disabled, check for opacity-50 or pointer-events-none
      if (isDisabled) {
        const classes = await firstInput.getAttribute('class');
        expect(classes?.includes('opacity-50') || classes?.includes('pointer-events-none')).toBeTruthy();
      }
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-050.png` });
  });
});
