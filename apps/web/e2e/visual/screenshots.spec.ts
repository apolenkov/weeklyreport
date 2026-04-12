import { test, expect } from '../fixtures';

// Pages to capture for visual regression
const leadPages = [
  { name: 'lead-report', path: '/lead/report' },
] as const;

const headPages = [
  { name: 'admin-panel', path: '/admin' },
] as const;

const viewerPages = [
  { name: 'report-history', path: '/reports/history' },
] as const;

const publicPages = [
  { name: 'auth-error-expired', path: '/auth/error?reason=session_expired' },
  { name: 'auth-error-forbidden', path: '/auth/error?reason=forbidden' },
] as const;

test.describe('Visual regression screenshots', () => {
  for (const entry of leadPages) {
    test(`screenshot: ${entry.name}`, async ({ leadPage }) => {
      await leadPage.goto(entry.path);
      // Wait for content to render
      await leadPage.getByRole('heading', { level: 1 }).waitFor({ timeout: 30_000 });

      await expect(leadPage).toHaveScreenshot(`${entry.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }

  for (const entry of headPages) {
    test(`screenshot: ${entry.name}`, async ({ headPage }) => {
      await headPage.goto(entry.path);
      await headPage.getByRole('heading', { level: 1 }).waitFor({ timeout: 15_000 });

      await expect(headPage).toHaveScreenshot(`${entry.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }

  for (const entry of viewerPages) {
    test(`screenshot: ${entry.name}`, async ({ viewerPage }) => {
      await viewerPage.goto(entry.path);
      await viewerPage.getByRole('heading', { level: 1 }).waitFor({ timeout: 15_000 });

      await expect(viewerPage).toHaveScreenshot(`${entry.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }

  for (const entry of publicPages) {
    test(`screenshot: ${entry.name}`, async ({ leadPage }) => {
      await leadPage.goto(entry.path);
      await leadPage.waitForTimeout(2000);

      await expect(leadPage).toHaveScreenshot(`${entry.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
});
