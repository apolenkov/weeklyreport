import { expect, test } from '@playwright/test';

const devSessionStorageKey = 'customreport:dev-session';
const leadReportStorageKey = 'customreport:lead-report-section';
const publishedReportStorageKey = 'customreport:published-report';

const headSession = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: 'head@customreport.local',
  name: 'Department Head',
  role: 'head',
  activeReportId: '22222222-2222-4222-8222-222222222222',
  activeReportSectionId: null,
};

test('head can publish the assembled report and the surface becomes read-only', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    ({ sessionKey, sectionKey, publishedKey, session }) => {
      window.localStorage.removeItem(sectionKey);
      window.localStorage.removeItem(publishedKey);
      window.localStorage.setItem(sessionKey, JSON.stringify(session));
    },
    {
      sessionKey: devSessionStorageKey,
      sectionKey: leadReportStorageKey,
      publishedKey: publishedReportStorageKey,
      session: headSession,
    },
  );

  await page.goto('/head/report');

  await expect(page.getByRole('heading', { name: 'Assembled Report' })).toBeVisible();
  await page.getByLabel('Lead 1 / Project 1 traffic light').selectOption('yellow');
  await page.getByRole('button', { name: 'Publish report' }).click();

  await expect(page.getByText('Report published')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish report' })).toHaveCount(0);
  await expect(page.getByLabel('Lead 1 / Project 1 traffic light')).toBeDisabled();
});
