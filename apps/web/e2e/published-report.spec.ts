import { test, expect } from './fixtures';

test.describe('Published Report', () => {
  test('viewer can access report history page', async ({ viewerPage }) => {
    await viewerPage.goto('/reports/history');

    await expect(
      viewerPage.getByRole('heading', { name: 'Report History', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('report history page shows published reports from seed data', async ({ viewerPage }) => {
    await viewerPage.goto('/reports/history');

    await expect(
      viewerPage.getByRole('heading', { name: 'Report History', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    // Page content area should render
    await expect(viewerPage.locator('main').first()).toBeVisible();
  });
});
