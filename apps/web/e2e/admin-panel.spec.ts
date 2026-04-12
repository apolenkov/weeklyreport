import { test, expect } from './fixtures';

test('lead users are blocked from the admin route', async ({ leadPage }) => {
  await leadPage.goto('/admin');

  // QueryError component renders FORBIDDEN message for lead users
  await expect(
    leadPage.getByText(
      /do not have permission|FORBIDDEN|access denied|unauthorized/i,
    ),
  ).toBeVisible({ timeout: 15_000 });
});

test('head users can access the admin panel and see the heading', async ({ headPage }) => {
  await headPage.goto('/admin');

  await expect(headPage.getByRole('heading', { name: 'Admin Panel', level: 1 })).toBeVisible();

  // Users table should be visible (default tab)
  await expect(
    headPage.getByRole('table', { name: 'Users' }),
  ).toBeVisible();

  // Seed data has users -- at least one lead row visible
  await expect(headPage.getByRole('cell', { name: 'Lead 1' })).toBeVisible();
});

test('head users can add a user from the admin panel via CrudSheet', async ({ headPage }) => {
  await headPage.goto('/admin');

  await expect(headPage.getByRole('heading', { name: 'Admin Panel', level: 1 })).toBeVisible();

  // Click "Add User" to open CrudSheet
  await headPage.getByRole('button', { name: 'Add User' }).click();

  // CrudSheet dialog opens
  const sheet = headPage.locator('[role="dialog"]');
  await expect(sheet.getByText('Add User')).toBeVisible();

  // Fill user form
  await headPage.getByLabel('Name').fill('Lead 2');
  await headPage.getByLabel('Email').fill('lead2@customreport.local');

  // Select role via shadcn Select
  const roleTrigger = headPage.getByLabel('Role');
  await roleTrigger.click();
  await headPage.getByRole('option', { name: 'Lead' }).click();

  // Submit the form
  await sheet.getByRole('button', { name: 'Add User' }).click();

  // Verify success toast and table update
  await expect(headPage.getByText('User added')).toBeVisible();
  await expect(headPage.getByRole('cell', { name: 'Lead 2' })).toBeVisible();
});

test('head users can create a project and period from admin panel', async ({ headPage }) => {
  await headPage.goto('/admin');

  await expect(headPage.getByRole('heading', { name: 'Admin Panel', level: 1 })).toBeVisible();

  // Switch to Projects tab and create a project
  await headPage.getByRole('tab', { name: 'Projects' }).click();
  await expect(headPage.getByRole('table', { name: 'Projects' })).toBeVisible();

  await headPage.getByRole('button', { name: 'Add Project' }).click();
  const projectSheet = headPage.locator('[role="dialog"]');
  await expect(projectSheet.getByText('Add Project')).toBeVisible();
  await projectSheet.getByRole('button', { name: 'Create Project' }).click();
  await expect(headPage.getByText('Project created')).toBeVisible();

  // Switch to Periods tab and create a period
  await headPage.getByRole('tab', { name: 'Periods' }).click();
  await expect(headPage.getByRole('table', { name: 'Report periods' })).toBeVisible();

  await headPage.getByRole('button', { name: 'Add Period' }).click();
  const periodSheet = headPage.locator('[role="dialog"]');
  await expect(periodSheet.getByText('Add Period')).toBeVisible();
  await periodSheet.getByRole('button', { name: 'Create Period' }).click();
  await expect(headPage.getByText('Period created')).toBeVisible();
});
