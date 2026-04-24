/**
 * Visual Regression Baselines — Screenshot E2E Tests
 *
 * Captures full-page screenshots for every key page in the application.
 * On the first run these generate baseline images; subsequent runs
 * compare against them with a 1% pixel-diff tolerance.
 *
 * Run with `--update-snapshots` to regenerate baselines.
 *
 * Covers: E2E-10 (Visual regression baselines)
 */

import { test, expect } from '../fixtures';
import { test as base } from '@playwright/test';

// ---------------------------------------------------------------------------
// Unauthenticated pages — use the base page fixture (no storage state)
// ---------------------------------------------------------------------------

base.describe('Visual Baselines — Public Pages', () => {
  base.describe.configure({ mode: 'serial' });

  base('login page', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    await expect(page).toHaveScreenshot('login.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  base('auth error page', async ({ page }) => {
    await page.goto('/auth/error?reason=session_expired');
    await page.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    await expect(page).toHaveScreenshot('auth-error.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  base('published report page', async ({ page }) => {
    await page.goto('/reports/test-id');
    await page.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    await expect(page).toHaveScreenshot('published-report.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  base('print page', async ({ page }) => {
    await page.goto('/reports/test-id/print');
    // Print page uses a <main> element without #main-content id
    await page.waitForSelector('main', { state: 'visible', timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    await expect(page).toHaveScreenshot('print-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
});

// ---------------------------------------------------------------------------
// Lead pages — use leadPage fixture (lead storage state)
// ---------------------------------------------------------------------------

test.describe('Visual Baselines — Lead Pages', () => {
  test.describe.configure({ mode: 'serial' });

  test('lead report form', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');
    await leadPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await leadPage.getByText('Product Status').waitFor({ state: 'visible', timeout: 15_000 });
    await leadPage.waitForLoadState('networkidle', { timeout: 15_000 });

    await expect(leadPage).toHaveScreenshot('lead-report.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  test('lead history', async ({ leadPage }) => {
    await leadPage.goto('/lead/history');
    await leadPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await leadPage.waitForLoadState('networkidle', { timeout: 15_000 });

    await expect(leadPage).toHaveScreenshot('lead-history.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
});

// ---------------------------------------------------------------------------
// Head / Admin pages — use headPage fixture (head storage state)
// ---------------------------------------------------------------------------

test.describe('Visual Baselines — Head & Admin Pages', () => {
  test.describe.configure({ mode: 'serial' });

  test('head dashboard', async ({ headPage }) => {
    await headPage.goto('/head/dashboard');
    await headPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await headPage.getByRole('heading', { name: 'Dashboard' }).waitFor({ state: 'visible', timeout: 15_000 });
    await headPage.waitForLoadState('networkidle', { timeout: 15_000 });

    await expect(headPage).toHaveScreenshot('head-dashboard.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  test('weekly report', async ({ headPage }) => {
    await headPage.goto('/head/report');
    await headPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await headPage.waitForLoadState('networkidle', { timeout: 15_000 });

    await expect(headPage).toHaveScreenshot('weekly-report.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  test('admin users tab', async ({ headPage }) => {
    await headPage.goto('/admin?tab=users');
    await headPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await headPage.waitForLoadState('networkidle', { timeout: 15_000 });

    await expect(headPage).toHaveScreenshot('admin-users.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  test('admin products tab', async ({ headPage }) => {
    await headPage.goto('/admin?tab=products');
    await headPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await headPage.waitForLoadState('networkidle', { timeout: 15_000 });

    await expect(headPage).toHaveScreenshot('admin-products.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
});
