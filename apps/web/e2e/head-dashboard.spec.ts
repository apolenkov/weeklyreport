import { expect, test } from '@playwright/test';

const devSessionStorageKey = 'customreport:dev-session';
const leadReportStorageKey = 'customreport:lead-report-section';

const leadSession = {
  userId: '33333333-3333-4333-8333-333333333333',
  email: 'lead1@customreport.local',
  name: 'Lead 1',
  role: 'lead',
  activeReportId: '22222222-2222-4222-8222-222222222222',
  activeReportSectionId: '11111111-1111-4111-8111-111111111111',
};

const headSession = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: 'head@customreport.local',
  name: 'Department Head',
  role: 'head',
  activeReportId: '22222222-2222-4222-8222-222222222222',
  activeReportSectionId: null,
};

test('lead users are blocked from the head dashboard route', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    ({ sessionKey, sectionKey, session }) => {
      window.localStorage.removeItem(sectionKey);
      window.localStorage.setItem(sessionKey, JSON.stringify(session));
    },
    {
      sessionKey: devSessionStorageKey,
      sectionKey: leadReportStorageKey,
      session: leadSession,
    },
  );

  await page.goto('/head/dashboard');

  await expect(page.getByRole('heading', { name: 'Review Dashboard' })).toBeVisible();
  await expect(
    page.getByText('Access denied. This dashboard is available only to head users.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'My Report' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Submission dashboard' })).toHaveCount(0);
});

test('head dashboard shows draft first and reflects lead submission after submit succeeds', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    ({ sessionKey, sectionKey, session }) => {
      window.localStorage.removeItem(sectionKey);
      window.localStorage.setItem(sessionKey, JSON.stringify(session));
    },
    {
      sessionKey: devSessionStorageKey,
      sectionKey: leadReportStorageKey,
      session: headSession,
    },
  );

  await page.goto('/head/dashboard');

  await expect(page.getByRole('link', { name: 'Review Dashboard' })).toBeVisible();
  const dashboardRowsBeforeSubmit = page.locator('tbody tr');

  await expect(dashboardRowsBeforeSubmit.nth(0)).toContainText('Lead 1');
  await expect(dashboardRowsBeforeSubmit.nth(0)).toContainText('draft');

  await page.evaluate(
    ({ sessionKey, session }) => {
      window.localStorage.setItem(sessionKey, JSON.stringify(session));
    },
    {
      sessionKey: devSessionStorageKey,
      session: leadSession,
    },
  );

  await page.goto('/lead/report');
  await page.getByLabel('Project 1 traffic light').selectOption('green');
  await page.getByRole('button', { name: 'Submit section' }).click();
  await page.getByRole('button', { name: 'Confirm submit' }).click();
  await expect(page.getByText('Секция отправлена')).toBeVisible();

  await page.evaluate(
    ({ sessionKey, session }) => {
      window.localStorage.setItem(sessionKey, JSON.stringify(session));
    },
    {
      sessionKey: devSessionStorageKey,
      session: headSession,
    },
  );

  await page.goto('/head/dashboard');

  const leadOneRow = page.locator('tbody tr').filter({ hasText: 'Lead 1' });

  await expect(leadOneRow).toContainText('submitted');
});
