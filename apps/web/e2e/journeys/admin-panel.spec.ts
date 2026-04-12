import { test, expect } from '../fixtures';

test.describe('Admin Panel - User Management', () => {
  test('admin views user list with all seeded users', async ({ headPage }) => {
    await headPage.goto('/admin');

    await expect(
      headPage.getByRole('heading', { name: 'Admin Panel', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    // Users table should be visible (default tab)
    await expect(
      headPage.getByRole('table', { name: 'Users' }),
    ).toBeVisible();

    // Verify at least Lead 1 row is visible
    await expect(headPage.getByRole('cell', { name: 'Lead 1' })).toBeVisible();
  });

  test('admin sees all four tabs', async ({ headPage }) => {
    await headPage.goto('/admin');

    await expect(
      headPage.getByRole('heading', { name: 'Admin Panel', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(headPage.getByRole('tab', { name: 'Users' })).toBeVisible();
    await expect(headPage.getByRole('tab', { name: 'Projects' })).toBeVisible();
    await expect(headPage.getByRole('tab', { name: 'Periods' })).toBeVisible();
    await expect(headPage.getByRole('tab', { name: 'Reminders' })).toBeVisible();
  });

  test('admin sees Add User button', async ({ headPage }) => {
    await headPage.goto('/admin');

    await expect(
      headPage.getByRole('table', { name: 'Users' }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      headPage.getByRole('button', { name: 'Add User' }),
    ).toBeVisible();
  });

  test('admin users table has Name, Email, Role columns', async ({ headPage }) => {
    await headPage.goto('/admin');

    await expect(
      headPage.getByRole('table', { name: 'Users' }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(headPage.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(headPage.getByRole('columnheader', { name: 'Email' })).toBeVisible();
    await expect(headPage.getByRole('columnheader', { name: 'Role' })).toBeVisible();
    await expect(headPage.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
  });
});

test.describe('Admin Panel - Projects Tab', () => {
  test('admin switches to Projects tab and sees project data', async ({ headPage }) => {
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
});

test.describe('Admin Panel - Periods Tab', () => {
  test('admin switches to Periods tab and sees report periods table', async ({ headPage }) => {
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

test.describe('Admin Panel - Reminders Tab', () => {
  test('admin switches to Reminders tab', async ({ headPage }) => {
    await headPage.goto('/admin');

    await expect(
      headPage.getByRole('heading', { name: 'Admin Panel', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    const remindersTab = headPage.getByRole('tab', { name: 'Reminders' });
    await expect(remindersTab).toBeVisible();
    await remindersTab.click();

    // Reminders tab content should load (table or empty state)
    await headPage.waitForTimeout(500);
  });
});

test.describe('Admin Panel - Access Control', () => {
  test('lead cannot access admin panel', async ({ leadPage }) => {
    await leadPage.goto('/admin');

    // Lead sees error (FORBIDDEN mapped to generic error)
    await expect(
      leadPage.getByText(
        /do not have permission|FORBIDDEN|access denied|Something went wrong/i,
      ),
    ).toBeVisible({ timeout: 15_000 });

    // Admin heading should NOT be visible for lead
    await expect(
      leadPage.getByRole('heading', { name: 'Admin Panel', level: 1 }),
    ).toHaveCount(0);
  });
});
