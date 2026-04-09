import { expect, test } from '@playwright/test';

const devSessionStorageKey = 'customreport:dev-session';
const leadReportStorageKey = 'customreport:lead-report-section';
const publishedReportStorageKey = 'customreport:published-report';
const reportId = '22222222-2222-4222-8222-222222222222';

const headSession = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: 'head@customreport.local',
  name: 'Department Head',
  role: 'head',
  activeReportId: reportId,
  activeReportSectionId: null,
};

const viewerSession = {
  userId: '00000000-0000-4000-8000-000000000099',
  email: 'viewer@customreport.local',
  name: 'Stakeholder Viewer',
  role: 'viewer',
  activeReportId: reportId,
  activeReportSectionId: null,
};

test('viewer can read the published report and request async PDF export', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Publish report' }).click();
  await expect(page.getByText('Report published')).toBeVisible();

  await page.evaluate(
    ({ sessionKey, session }) => {
      window.localStorage.setItem(sessionKey, JSON.stringify(session));
    },
    {
      sessionKey: devSessionStorageKey,
      session: viewerSession,
    },
  );

  await page.goto(`/reports/${reportId}`);

  await expect(page.getByRole('heading', { name: 'Published Report' })).toBeVisible();
  await expect(page.getByText('Published by Department Head')).toBeVisible();
  await expect(page.getByText('Current week update for Project 3')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish report' })).toHaveCount(0);
  await expect(page.locator('select')).toHaveCount(0);
  await expect(page.locator('input')).toHaveCount(0);

  await page.getByRole('button', { name: 'Export PDF' }).click();

  await expect(page.getByText('Export status: completed')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download PDF' })).toBeVisible();
});
