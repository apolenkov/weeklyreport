import { test, expect } from '../fixtures';

// Visual regression baselines for all critical page states (D-09..D-11)
// Desktop viewport: 1280x720 (Chromium default from playwright.config.ts)
// Options per D-10: fullPage, animations disabled, 1% pixel threshold

test.describe('Visual regression screenshots', () => {
  // --- Lead role pages ---

  test('screenshot: lead-report', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');
    await leadPage.getByRole('heading', { level: 1 }).waitFor({ timeout: 30_000 });
    await expect(leadPage).toHaveScreenshot('lead-report.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    });
  });

  // --- Head role pages ---

  test('screenshot: head-dashboard', async ({ headPage }) => {
    await headPage.goto('/head/dashboard');
    // Wait for any heading (h1 for loaded pages, h2 for EmptyState)
    await headPage.getByRole('heading').first().waitFor({ timeout: 15_000 });
    await expect(headPage).toHaveScreenshot('head-dashboard.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    });
  });

  test('screenshot: head-report', async ({ headPage }) => {
    await headPage.goto('/head/report');
    // Wait for any heading (h1 for assembled report, h2 for EmptyState)
    await headPage.getByRole('heading').first().waitFor({ timeout: 15_000 });
    await expect(headPage).toHaveScreenshot('head-report.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    });
  });

  test('screenshot: admin-panel', async ({ headPage }) => {
    await headPage.goto('/admin');
    await headPage.getByRole('heading').first().waitFor({ timeout: 15_000 });
    await expect(headPage).toHaveScreenshot('admin-panel.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    });
  });

  // --- Viewer role pages ---

  test('screenshot: report-history', async ({ viewerPage }) => {
    await viewerPage.goto('/reports/history');
    // Wait for any heading (h1 for list, h2 for EmptyState)
    await viewerPage.getByRole('heading').first().waitFor({ timeout: 15_000 });
    await expect(viewerPage).toHaveScreenshot('report-history.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    });
  });

  // --- Public / error pages ---

  test('screenshot: auth-error-expired', async ({ leadPage }) => {
    await leadPage.goto('/auth/error?reason=session_expired');
    await leadPage.waitForTimeout(2000);
    await expect(leadPage).toHaveScreenshot('auth-error-expired.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    });
  });

  test('screenshot: auth-error-forbidden', async ({ leadPage }) => {
    await leadPage.goto('/auth/error?reason=forbidden');
    await leadPage.waitForTimeout(2000);
    await expect(leadPage).toHaveScreenshot('auth-error-forbidden.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    });
  });
});
