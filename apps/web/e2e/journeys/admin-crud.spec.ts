import { test, expect } from '../fixtures';

test.describe('Admin CRUD', () => {
  test('head can access admin panel and see Users table', async ({ headPage }) => {
    await headPage.goto('/admin');

    await expect(
      headPage.getByRole('heading', { name: 'Admin Panel', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      headPage.getByRole('table', { name: 'Users' }),
    ).toBeVisible();

    // Seed data has 8 users (6 leads + 1 head + 1 viewer)
    await expect(headPage.getByRole('cell', { name: 'Lead 1' })).toBeVisible();
  });

  test('head sees Add User button on Users tab', async ({ headPage }) => {
    await headPage.goto('/admin');

    await expect(
      headPage.getByRole('table', { name: 'Users' }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      headPage.getByRole('button', { name: 'Add User' }),
    ).toBeVisible();
  });

  test('head can switch to Projects tab and see project data', async ({ headPage }) => {
    await headPage.goto('/admin');

    await expect(
      headPage.getByRole('heading', { name: 'Admin Panel', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    await headPage.getByRole('tab', { name: 'Projects' }).click();

    await expect(
      headPage.getByRole('table', { name: 'Projects' }),
    ).toBeVisible();

    await expect(
      headPage.getByRole('cell', { name: 'Project 1' }),
    ).toBeVisible();

    await expect(
      headPage.getByRole('button', { name: 'Add Project' }),
    ).toBeVisible();
  });

  test('head can switch to Periods tab and see report periods', async ({ headPage }) => {
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

  test('lead cannot access admin panel', async ({ leadPage }) => {
    await leadPage.goto('/admin');

    await expect(
      leadPage.getByText(
        /do not have permission|FORBIDDEN|access denied|Something went wrong/i,
      ),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      leadPage.getByRole('heading', { name: 'Admin Panel', level: 1 }),
    ).toHaveCount(0);
  });
});
