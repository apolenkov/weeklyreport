import { expect, test } from '@playwright/test';

const devSessionStorageKey = 'customreport:dev-session';
const adminSnapshotStorageKey = 'customreport:admin-snapshot';

const headSession = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: 'head@customreport.local',
  name: 'Department Head',
  role: 'head',
  activeReportId: '22222222-2222-4222-8222-222222222222',
  activeReportSectionId: null,
};

const leadSession = {
  userId: '33333333-3333-4333-8333-333333333333',
  email: 'lead1@customreport.local',
  name: 'Lead 1',
  role: 'lead',
  activeReportId: '22222222-2222-4222-8222-222222222222',
  activeReportSectionId: '11111111-1111-4111-8111-111111111111',
};

test('lead users are blocked from the admin route', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    ({ sessionKey, snapshotKey, session }) => {
      window.localStorage.removeItem(snapshotKey);
      window.localStorage.setItem(sessionKey, JSON.stringify(session));
    },
    {
      sessionKey: devSessionStorageKey,
      snapshotKey: adminSnapshotStorageKey,
      session: leadSession,
    },
  );

  await page.goto('/admin');

  await expect(page.getByText('Access denied. Admin panel is available only to head users.')).toBeVisible();
});

test('head users can add admin-managed entities from the admin panel', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    ({ sessionKey, snapshotKey, session }) => {
      window.localStorage.removeItem(snapshotKey);
      window.localStorage.setItem(sessionKey, JSON.stringify(session));
    },
    {
      sessionKey: devSessionStorageKey,
      snapshotKey: adminSnapshotStorageKey,
      session: headSession,
    },
  );

  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();
  await page.getByLabel('New user name').fill('Lead 2');
  await page.getByLabel('New user email').fill('lead2@customreport.local');
  await page.getByLabel('New user role').selectOption('lead');
  await page.getByRole('button', { name: 'Add user' }).click();
  await expect(page.getByText('Lead 2')).toBeVisible();

  await page.getByRole('button', { name: 'Add project' }).click();
  await expect(page.getByText('Project Bootstrap')).toBeVisible();

  await page.getByRole('button', { name: 'Add period' }).click();
  await expect(page.getByText('88888888-8888-4888-8888-888888888888')).toBeVisible();

  await page.getByRole('button', { name: 'Add reminder rule' }).click();
  const latestReminderRow = page.locator('li').filter({ hasText: 'deadline' }).last();

  await expect(latestReminderRow).toBeVisible();

  await latestReminderRow.getByRole('button', { name: 'Run reminder' }).click();
  await expect(page.getByText('lead1@customreport.local — sent')).toBeVisible();

  await latestReminderRow.getByRole('button', { name: 'Run reminder' }).click();
  await expect(page.getByText('lead1@customreport.local — sent')).toHaveCount(1);
});
