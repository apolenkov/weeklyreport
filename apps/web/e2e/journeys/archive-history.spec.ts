import { test, expect } from '../fixtures';

test.describe('Archive History - Report List', () => {
  test('viewer sees Report History heading', async ({ viewerPage }) => {
    await viewerPage.goto('/reports/history');

    await expect(
      viewerPage.getByRole('heading', { name: 'Report History', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('head can also access report history', async ({ headPage }) => {
    await headPage.goto('/reports/history');

    await expect(
      headPage.getByRole('heading', { name: 'Report History', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Archive History - Report Detail', () => {
  test('viewer sees report history page content', async ({ viewerPage }) => {
    await viewerPage.goto('/reports/history');

    await expect(
      viewerPage.getByRole('heading', { name: 'Report History', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    // Page renders with at least the main content area
    await expect(viewerPage.locator('main').first()).toBeVisible();
  });
});
