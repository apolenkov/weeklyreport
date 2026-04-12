import { test, expect } from '../fixtures';

test.describe('Carry-Over - Admin Access', () => {
  test('head can access admin panel for carry-over management', async ({ headPage }) => {
    await headPage.goto('/admin');

    await expect(
      headPage.getByRole('heading', { name: 'Admin Panel', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    // Admin panel is accessible with Users tab
    await expect(headPage.getByRole('table', { name: 'Users' })).toBeVisible();
  });

  test('head can switch to Periods tab', async ({ headPage }) => {
    await headPage.goto('/admin');

    await expect(
      headPage.getByRole('heading', { name: 'Admin Panel', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    await headPage.getByRole('tab', { name: 'Periods' }).click();
    await expect(
      headPage.getByRole('table', { name: 'Report periods' }),
    ).toBeVisible();
  });
});

test.describe('Carry-Over - Lead Form', () => {
  test('lead sees My Report heading and form sections', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    // Lead name and status visible
    await expect(leadPage.getByText('Lead 1')).toBeVisible();
    await expect(
      leadPage.getByText('Submitted', { exact: true }).or(leadPage.getByText('Draft', { exact: true })),
    ).toBeVisible();
  });

  test('lead report has priority fields', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    await expect(leadPage.getByRole('textbox', { name: 'Priority 1' })).toBeVisible();
    await expect(leadPage.getByRole('textbox', { name: 'Priority 2' })).toBeVisible();
    await expect(leadPage.getByRole('textbox', { name: 'Priority 3' })).toBeVisible();
  });
});
