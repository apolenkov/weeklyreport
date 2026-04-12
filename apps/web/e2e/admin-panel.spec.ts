import { test, expect } from './fixtures';

test.describe('Admin Panel', () => {
  test('lead users are blocked from the admin route', async ({ leadPage }) => {
    await leadPage.goto('/admin');

    // Lead accessing admin shows error (FORBIDDEN mapped to "Something went wrong")
    await expect(
      leadPage.getByText(
        /do not have permission|FORBIDDEN|access denied|unauthorized|Something went wrong/i,
      ),
    ).toBeVisible({ timeout: 15_000 });

    // Admin heading should NOT be visible for lead
    await expect(
      leadPage.getByRole('heading', { name: 'Admin Panel', level: 1 }),
    ).toHaveCount(0);
  });

  test('head users can access the admin panel and see the heading', async ({ headPage }) => {
    await headPage.goto('/admin');

    await expect(
      headPage.getByRole('heading', { name: 'Admin Panel', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    // Users table should be visible (default tab)
    await expect(
      headPage.getByRole('table', { name: 'Users' }),
    ).toBeVisible();

    // Seed data has users -- Lead 1 row visible
    await expect(headPage.getByRole('cell', { name: 'Lead 1' })).toBeVisible();
  });

  test('admin panel has four tabs: Users, Projects, Periods, Reminders', async ({ headPage }) => {
    await headPage.goto('/admin');

    await expect(
      headPage.getByRole('heading', { name: 'Admin Panel', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(headPage.getByRole('tab', { name: 'Users' })).toBeVisible();
    await expect(headPage.getByRole('tab', { name: 'Projects' })).toBeVisible();
    await expect(headPage.getByRole('tab', { name: 'Periods' })).toBeVisible();
    await expect(headPage.getByRole('tab', { name: 'Reminders' })).toBeVisible();
  });

  test('Users tab shows Add User button and table with seed data', async ({ headPage }) => {
    await headPage.goto('/admin');

    await expect(
      headPage.getByRole('table', { name: 'Users' }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      headPage.getByRole('button', { name: 'Add User' }),
    ).toBeVisible();

    // Verify table has header columns
    await expect(headPage.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(headPage.getByRole('columnheader', { name: 'Email' })).toBeVisible();
    await expect(headPage.getByRole('columnheader', { name: 'Role' })).toBeVisible();
  });

  test('Projects tab shows Add Project button and project data', async ({ headPage }) => {
    await headPage.goto('/admin');

    await expect(
      headPage.getByRole('heading', { name: 'Admin Panel', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    await headPage.getByRole('tab', { name: 'Projects' }).click();

    await expect(
      headPage.getByRole('table', { name: 'Projects' }),
    ).toBeVisible();

    await expect(
      headPage.getByRole('button', { name: 'Add Project' }),
    ).toBeVisible();

    // Seed data has Project 1
    await expect(
      headPage.getByRole('cell', { name: 'Project 1' }),
    ).toBeVisible();
  });

  test('Periods tab shows Add Period button and report periods table', async ({ headPage }) => {
    await headPage.goto('/admin');

    await expect(
      headPage.getByRole('heading', { name: 'Admin Panel', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    await headPage.getByRole('tab', { name: 'Periods' }).click();

    await expect(
      headPage.getByRole('table', { name: 'Report periods' }),
    ).toBeVisible();

    await expect(
      headPage.getByRole('button', { name: 'Add Period' }),
    ).toBeVisible();
  });
});
