import { test, expect } from '../fixtures';

// ─── Pages to capture ────────────────────────────────────────────────

const leadPages = [
  { name: 'lead-report', path: '/lead/report' },
] as const;

const headPages = [
  { name: 'head-dashboard', path: '/head/dashboard' },
  { name: 'head-report', path: '/head/report' },
  { name: 'admin-panel', path: '/admin' },
] as const;

const viewerPages = [
  { name: 'report-history', path: '/reports/history' },
] as const;

const publicPages = [
  { name: 'landing', path: '/' },
  { name: 'auth-error-expired', path: '/auth/error?reason=session_expired' },
  { name: 'auth-error-forbidden', path: '/auth/error?reason=forbidden' },
] as const;

// ─── Visual regression tests ─────────────────────────────────────────

test.describe('Visual regression screenshots', () => {
  for (const entry of leadPages) {
    test(`screenshot: ${entry.name}`, async ({ leadPage }) => {
      await leadPage.goto(entry.path);
      await leadPage.waitForLoadState('networkidle');

      await expect(leadPage).toHaveScreenshot(`${entry.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }

  for (const entry of headPages) {
    test(`screenshot: ${entry.name}`, async ({ headPage }) => {
      await headPage.goto(entry.path);
      await headPage.waitForLoadState('networkidle');

      await expect(headPage).toHaveScreenshot(`${entry.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }

  for (const entry of viewerPages) {
    test(`screenshot: ${entry.name}`, async ({ viewerPage }) => {
      await viewerPage.goto(entry.path);
      await viewerPage.waitForLoadState('networkidle');

      await expect(viewerPage).toHaveScreenshot(`${entry.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }

  for (const entry of publicPages) {
    test(`screenshot: ${entry.name}`, async ({ leadPage }) => {
      // Use any authenticated page to navigate to public routes
      await leadPage.goto(entry.path);
      await leadPage.waitForLoadState('networkidle');

      await expect(leadPage).toHaveScreenshot(`${entry.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
});
