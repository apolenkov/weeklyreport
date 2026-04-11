import { test, expect } from '../fixtures';

test.describe('Admin CRUD', () => {
  test('head can access admin panel and manage users, projects, and periods', async ({
    headPage,
  }) => {
    await headPage.goto('/admin');

    // AdminPanel renders heading "Admin Panel"
    await expect(
      headPage.getByRole('heading', { name: 'Admin Panel', level: 1 }),
    ).toBeVisible();

    // --- Step 1: Users tab (default) ---
    // Tabs component has TabsTrigger buttons and DataTable with aria-label="Users"
    await expect(
      headPage.getByRole('table', { name: 'Users' }),
    ).toBeVisible();

    // Seed data has 8 users (6 leads + 1 head + 1 viewer)
    // Verify at least one lead row is visible
    await expect(headPage.getByRole('cell', { name: 'Lead 1' })).toBeVisible();

    // --- Step 2: Create a new user via CrudSheet ---
    await headPage.getByRole('button', { name: 'Add User' }).click();

    // CrudSheet (Sheet component) opens with title "Add User"
    const sheet = headPage.locator('[role="dialog"]');
    await expect(sheet.getByText('Add User')).toBeVisible();

    // Fill user form fields
    await headPage.getByLabel('Name').fill('E2E Test Lead');
    await headPage.getByLabel('Email').fill('e2e-lead@test.local');

    // Select role using shadcn Select (Radix combobox trigger)
    const roleTrigger = headPage.getByLabel('Role');
    await roleTrigger.click();

    // Select "Lead" option from the dropdown
    await headPage.getByRole('option', { name: 'Lead' }).click();

    // Submit the form via CrudSheet's submit button (submitLabel="Add User")
    await sheet.getByRole('button', { name: 'Add User' }).click();

    // Verify success toast
    await expect(headPage.getByText('User added')).toBeVisible();

    // Verify new user appears in the table
    await expect(
      headPage.getByRole('cell', { name: 'E2E Test Lead' }),
    ).toBeVisible();

    // --- Step 3: Projects tab ---
    await headPage.getByRole('tab', { name: 'Projects' }).click();

    // DataTable with aria-label="Projects"
    await expect(
      headPage.getByRole('table', { name: 'Projects' }),
    ).toBeVisible();

    // Seed data has 6 projects
    await expect(
      headPage.getByRole('cell', { name: 'Project 1' }),
    ).toBeVisible();

    // Create a project via CrudSheet (bootstrap)
    await headPage.getByRole('button', { name: 'Add Project' }).click();
    const projectSheet = headPage.locator('[role="dialog"]');
    await expect(projectSheet.getByText('Add Project')).toBeVisible();
    await projectSheet
      .getByRole('button', { name: 'Create Project' })
      .click();

    // Verify success toast
    await expect(headPage.getByText('Project created')).toBeVisible();

    // Verify bootstrap project appears
    await expect(
      headPage.getByRole('cell', { name: 'Project Bootstrap' }),
    ).toBeVisible();

    // --- Step 4: Periods tab ---
    await headPage.getByRole('tab', { name: 'Periods' }).click();

    // DataTable with aria-label="Report periods"
    await expect(
      headPage.getByRole('table', { name: 'Report periods' }),
    ).toBeVisible();

    // Create a period via CrudSheet (bootstrap)
    await headPage.getByRole('button', { name: 'Add Period' }).click();
    const periodSheet = headPage.locator('[role="dialog"]');
    await expect(periodSheet.getByText('Add Period')).toBeVisible();
    await periodSheet
      .getByRole('button', { name: 'Create Period' })
      .click();

    // Verify success toast
    await expect(headPage.getByText('Period created')).toBeVisible();
  });

  test('lead cannot access admin panel', async ({ leadPage }) => {
    await leadPage.goto('/admin');

    // QueryError component renders FORBIDDEN message:
    // "You do not have permission to access this page."
    // The admin page calls trpc.admin.snapshot which requires head role.
    // Lead gets FORBIDDEN error -> QueryError shows the message.
    await expect(
      leadPage.getByText(
        /do not have permission|FORBIDDEN|access denied|unauthorized/i,
      ),
    ).toBeVisible({ timeout: 15_000 });
  });
});
