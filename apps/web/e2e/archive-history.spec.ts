import { test, expect } from './fixtures';

test.describe('Archive History', () => {
  test('viewer can browse report history page', async ({ viewerPage }) => {
    await viewerPage.goto('/reports/history');

    await expect(
      viewerPage.getByRole('heading', { name: 'Report History', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('report history is accessible by head role too', async ({ headPage }) => {
    await headPage.goto('/reports/history');

    await expect(
      headPage.getByRole('heading', { name: 'Report History', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
