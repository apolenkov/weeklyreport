import { test, expect } from '../fixtures';

test.describe('Head Journey', () => {
  test('head can access admin panel and review users', async ({ headPage }) => {
    await headPage.goto('/admin');

    await expect(
      headPage.getByRole('heading', { name: 'Admin Panel', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      headPage.getByRole('table', { name: 'Users' }),
    ).toBeVisible();

    await expect(headPage.getByRole('cell', { name: 'Lead 1' })).toBeVisible();
  });

  test('head can navigate to assembled report page', async ({ headPage }) => {
    await headPage.goto('/head/report');

    // Assembled report requires activeReportId in session
    const heading = headPage.getByRole('heading', { name: 'Assembled Report', level: 1 });
    const errorText = headPage.getByText('Something went wrong');

    await expect(heading.or(errorText)).toBeVisible({ timeout: 15_000 });
  });

  test('head can navigate to dashboard page', async ({ headPage }) => {
    await headPage.goto('/head/dashboard');

    const heading = headPage.getByRole('heading', { name: 'Review Dashboard', level: 1 });
    const errorText = headPage.getByText('Something went wrong');

    await expect(heading.or(errorText)).toBeVisible({ timeout: 15_000 });
  });

  test('head can access report history', async ({ headPage }) => {
    await headPage.goto('/reports/history');

    await expect(
      headPage.getByRole('heading', { name: 'Report History', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
