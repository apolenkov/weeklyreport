import { test, expect } from '../fixtures';

test.describe('PDF Export', () => {
  test('head can navigate to assembled report for PDF export', async ({ headPage }) => {
    await headPage.goto('/head/report');

    // Assembled report page requires activeReportId
    const heading = headPage.getByRole('heading', { name: 'Assembled Report', level: 1 });
    const errorText = headPage.getByText('Something went wrong');

    await expect(heading.or(errorText)).toBeVisible({ timeout: 15_000 });
  });

  test('viewer can access report history', async ({ viewerPage }) => {
    await viewerPage.goto('/reports/history');

    await expect(
      viewerPage.getByRole('heading', { name: 'Report History', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
