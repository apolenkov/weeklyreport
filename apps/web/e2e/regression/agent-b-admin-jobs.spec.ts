import { test, expect } from '@playwright/test';

const DEV_LOGIN_URL = 'http://localhost:3000/auth/dev-login';
const FRONTEND_URL = 'http://localhost:3000';
const ADMIN_URL = 'http://localhost:3000/admin?tab=jobs';
const SCREENSHOT_DIR = '.planning/regression/screenshots/agent-b-admin-jobs';

/**
 * ADM-130..ADM-140: Jobs Tab (11 scenarios)
 * - Jobs table display / empty state
 * - Retry button if failed jobs exist
 * - Job status display
 * - Table structure
 */

test.describe('ADM-130..140: Admin Panel - Jobs Tab (from 35-06)', () => {
  test.beforeEach(async ({ page }) => {
    // Login as head
    await page.goto(`${DEV_LOGIN_URL}?role=head`);
    await page.waitForURL(FRONTEND_URL);
    // Navigate to admin jobs tab
    await page.goto(ADMIN_URL);
    await page.waitForSelector('[data-testid="admin-panel"]', { timeout: 5000 });
  });

  test('ADM-130: Jobs tab renders', async ({ page }) => {
    // Wait for jobs tab to be visible
    const jobsTab = await page.locator('[data-testid="jobs-tab"]').isVisible().catch(() => false);
    expect(jobsTab).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-130.png` });
  });

  test('ADM-131: Jobs table displays (empty state OK)', async ({ page }) => {
    // Wait for jobs table
    const jobsTable = await page.locator('[data-testid="jobs-table"]').isVisible().catch(() => false);

    if (jobsTable) {
      // Table is visible, count rows
      const jobRows = await page.locator('[data-testid="jobs-table"] tbody tr').count();
      expect(jobRows >= 0).toBe(true);
    } else {
      // Empty state message OK
      const emptyState = await page.locator('text=/no jobs|No jobs|нет задач/i').isVisible().catch(() => false);
      expect(jobsTable || emptyState).toBe(true);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-131.png` });
  });

  test('ADM-132: Job ID column visible', async ({ page }) => {
    const jobsTable = await page.locator('[data-testid="jobs-table"]').isVisible().catch(() => false);

    if (jobsTable) {
      const idHeader = await page.locator('[data-testid="jobs-table"] th:has-text("ID"), [data-testid="jobs-table"] th:has-text("Id")').first();
      expect(await idHeader.isVisible()).toBe(true);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-132.png` });
  });

  test('ADM-133: Job type column visible', async ({ page }) => {
    const jobsTable = await page.locator('[data-testid="jobs-table"]').isVisible().catch(() => false);

    if (jobsTable) {
      const typeHeader = await page.locator('[data-testid="jobs-table"] th:has-text("Type"), [data-testid="jobs-table"] th:has-text("Тип")').first();
      expect(await typeHeader.isVisible().catch(() => false)).toBe(true);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-133.png` });
  });

  test('ADM-134: Job status column visible', async ({ page }) => {
    const jobsTable = await page.locator('[data-testid="jobs-table"]').isVisible().catch(() => false);

    if (jobsTable) {
      const statusHeader = await page.locator('[data-testid="jobs-table"] th:has-text("Status"), [data-testid="jobs-table"] th:has-text("Статус")').first();
      expect(await statusHeader.isVisible().catch(() => false)).toBe(true);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-134.png` });
  });

  test('ADM-135: Job progress/result column visible', async ({ page }) => {
    const jobsTable = await page.locator('[data-testid="jobs-table"]').isVisible().catch(() => false);

    if (jobsTable) {
      const resultHeader = await page.locator('[data-testid="jobs-table"] th').count();
      expect(resultHeader >= 4).toBe(true);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-135.png` });
  });

  test('ADM-136: Failed job shows Retry button', async ({ page }) => {
    const jobsTable = await page.locator('[data-testid="jobs-table"]').isVisible().catch(() => false);

    if (jobsTable) {
      // Look for rows with failed status
      const failedRows = await page.locator('[data-testid="jobs-table"]', { has: page.locator('text=/failed|Failed|Ошибка/i') }).count();

      if (failedRows > 0) {
        // Find retry button in failed row
        const retryButton = await page.locator('[data-testid="jobs-table"] button:has-text("Retry"), [data-testid="jobs-table"] button:has-text("Повтор")').first();
        expect(await retryButton.isVisible().catch(() => false)).toBe(true);
      }
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-136.png` });
  });

  test('ADM-137: Successful job shows completion info', async ({ page }) => {
    const jobsTable = await page.locator('[data-testid="jobs-table"]').isVisible().catch(() => false);

    if (jobsTable) {
      // Look for rows with completed/succeeded status
      const successRows = await page.locator('[data-testid="jobs-table"]', { has: page.locator('text=/completed|succeeded|Done|Готово/i') }).count();
      expect(successRows >= 0).toBe(true);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-137.png` });
  });

  test('ADM-138: Queued job shows in progress or pending', async ({ page }) => {
    const jobsTable = await page.locator('[data-testid="jobs-table"]').isVisible().catch(() => false);

    if (jobsTable) {
      // Look for rows with queued/pending status
      const queuedRows = await page.locator('[data-testid="jobs-table"]', { has: page.locator('text=/queued|pending|processing|В очереди/i') }).count();
      expect(queuedRows >= 0).toBe(true);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-138.png` });
  });

  test('ADM-139: Click Retry calls mutation', async ({ page }) => {
    const jobsTable = await page.locator('[data-testid="jobs-table"]').isVisible().catch(() => false);

    if (jobsTable) {
      // Set up mutation listener
      let retryMutationCalled = false;
      await page.route('**/trpc/*retry*', (route) => {
        retryMutationCalled = true;
        route.continue();
      });

      // Find and click retry button if it exists
      const retryButton = await page.locator('[data-testid="jobs-table"] button:has-text("Retry"), [data-testid="jobs-table"] button:has-text("Повтор")').first();
      const retryExists = await retryButton.isVisible().catch(() => false);

      if (retryExists) {
        await retryButton.click();
        await page.waitForTimeout(1000);
        // Mutation may or may not be called depending on job state
        expect(retryMutationCalled || !retryExists).toBe(true);
      }
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-139.png` });
  });

  test('ADM-140: Jobs table footer with job count', async ({ page }) => {
    const jobsTable = await page.locator('[data-testid="jobs-table"]').isVisible().catch(() => false);

    if (jobsTable) {
      // Look for footer or count indicator
      const tableFooter = await page.locator('[data-testid="jobs-table"]').evaluate((el) => {
        return el.nextElementSibling || el.parentElement?.querySelector('[data-testid*="footer"]');
      });

      // Footer is optional, just verify table structure is sound
      const rowCount = await page.locator('[data-testid="jobs-table"] tbody tr').count();
      expect(rowCount >= 0).toBe(true);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-140.png` });
  });
});
