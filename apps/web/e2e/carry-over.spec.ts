import { test, expect } from './fixtures';

test.describe('Carry Over', () => {
  test('head can access admin panel for carry-over actions', async ({ headPage }) => {
    await headPage.goto('/admin');

    await expect(
      headPage.getByRole('heading', { name: 'Admin Panel', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    // Admin panel is accessible, tabs work
    await expect(headPage.getByRole('tab', { name: 'Users' })).toBeVisible();
    await expect(headPage.getByRole('tab', { name: 'Periods' })).toBeVisible();
  });

  test('lead sees My Report heading after navigating to report page', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    // Lead sees their name and status
    await expect(leadPage.getByText('Lead 1')).toBeVisible();
  });
});
