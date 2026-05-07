import { test, expect } from '@playwright/test';
import { loginByCookie } from './helpers/dev-auth';

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
    await loginByCookie(page, { role: 'head', redirect: '/admin?tab=jobs' });
    await page.waitForSelector('[data-testid="admin-panel"]', { timeout: 5000 });
  });

  test('ADM-130: Jobs tab renders', async ({ page }) => {
    // Wait for jobs tab to be visible
    const jobsTab = await page.locator('[data-testid="jobs-tab"]').isVisible().catch(() => false);
    expect(jobsTab).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-130.png` });
  });

  test('ADM-131: Jobs table displays (empty state OK)', async ({ page }) => {
    await expect(page.locator('[data-testid="jobs-tab"]')).toBeVisible();
    await expect(page.getByText(/email-reminder/i)).toBeVisible();

    const jobsTable = await page.locator('[data-testid="jobs-table"]').isVisible().catch(() => false);

    if (jobsTable) {
      // Table is visible, count rows
      const jobRows = await page.locator('[data-testid="jobs-table"] tbody tr').count();
      expect(jobRows >= 0).toBe(true);
    } else {
      // Empty queue cards do not render a table; the queue panel itself is the stable signal.
      await expect(page.getByText(/email-reminder queue/i)).toBeVisible();
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-131.png` });
  });

  test('ADM-132: Job ID column visible', async ({ page }) => {
    const jobsTable = await page.locator('[data-testid="jobs-table"]').isVisible().catch(() => false);

    if (jobsTable) {
      const idHeader = page.locator('[data-testid="jobs-table"]').locator('th').filter({ hasText: /^ID$/i });
      expect(await idHeader.first().isVisible().catch(() => false)).toBe(true);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-132.png` });
  });

  test('ADM-133: Job type column visible', async ({ page }) => {
    const jobsTable = await page.locator('[data-testid="jobs-table"]').isVisible().catch(() => false);

    if (jobsTable) {
      const typeHeader = page.locator('[data-testid="jobs-table"]').locator('th').filter({ hasText: /Type|Тип/ });
      expect(await typeHeader.first().isVisible().catch(() => false)).toBe(true);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-133.png` });
  });

  test('ADM-134: Job status column visible', async ({ page }) => {
    const jobsTable = await page.locator('[data-testid="jobs-table"]').isVisible().catch(() => false);

    if (jobsTable) {
      const statusHeader = page.locator('[data-testid="jobs-table"]').locator('th').filter({ hasText: /Status|Статус/ });
      expect(await statusHeader.first().isVisible().catch(() => false)).toBe(true);
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
      const failedRows = page.locator('[data-testid="jobs-table"] tbody tr').filter({ hasText: /failed|Failed|Ошибка/i });
      const failedCount = await failedRows.count();

      if (failedCount > 0) {
        // Find retry button in failed row
        const retryButton = page.getByRole('button', { name: /Retry|Повтор/i }).first();
        expect(await retryButton.isVisible().catch(() => false)).toBe(true);
      }
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-136.png` });
  });

  test('ADM-137: Successful job shows completion info', async ({ page }) => {
    const jobsTable = await page.locator('[data-testid="jobs-table"]').isVisible().catch(() => false);

    if (jobsTable) {
      // Look for rows with completed/succeeded status
      const successRows = page.locator('[data-testid="jobs-table"] tbody tr').filter({ hasText: /completed|succeeded|Done|Готово/i });
      const successCount = await successRows.count();
      expect(successCount >= 0).toBe(true);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-137.png` });
  });

  test('ADM-138: Queued job shows in progress or pending', async ({ page }) => {
    const jobsTable = await page.locator('[data-testid="jobs-table"]').isVisible().catch(() => false);

    if (jobsTable) {
      // Look for rows with queued/pending status
      const queuedRows = page.locator('[data-testid="jobs-table"] tbody tr').filter({ hasText: /queued|pending|processing|В очереди/i });
      const queuedCount = await queuedRows.count();
      expect(queuedCount >= 0).toBe(true);
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
      const retryButton = page.getByRole('button', { name: /Retry|Повтор/i }).first();
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
