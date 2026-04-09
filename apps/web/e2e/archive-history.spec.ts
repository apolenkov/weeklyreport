import { expect, test } from '@playwright/test';

const devSessionStorageKey = 'customreport:dev-session';
const archiveStorageKey = 'customreport:archive-reports';

const viewerSession = {
  userId: '00000000-0000-4000-8000-000000000099',
  email: 'viewer@customreport.local',
  name: 'Stakeholder Viewer',
  role: 'viewer',
  activeReportId: '22222222-2222-4222-8222-222222222222',
  activeReportSectionId: null,
};

const archiveReports = [
  {
    summary: {
      reportId: '22222222-2222-4222-8222-222222222222',
      periodStart: '2026-04-06T00:00:00.000Z',
      periodEnd: '2026-04-12T23:59:59.000Z',
      publishedAt: '2026-04-09T14:00:00.000Z',
      publishedByName: 'Department Head',
      portfolioStatus: 'yellow',
    },
    report: {
      reportId: '22222222-2222-4222-8222-222222222222',
      periodStart: '2026-04-06T00:00:00.000Z',
      periodEnd: '2026-04-12T23:59:59.000Z',
      deadline: '2026-04-10T15:00:00.000Z',
      status: 'published',
      publishedAt: '2026-04-09T14:00:00.000Z',
      publishedById: '00000000-0000-4000-8000-000000000001',
      publishedByName: 'Department Head',
      portfolioOverview: { status: 'yellow', totals: { green: 1, yellow: 2, red: 0 } },
      sections: [],
    },
  },
  {
    summary: {
      reportId: '11111111-1111-4111-8111-111111111111',
      periodStart: '2026-03-30T00:00:00.000Z',
      periodEnd: '2026-04-05T23:59:59.000Z',
      publishedAt: '2026-04-05T14:00:00.000Z',
      publishedByName: 'Department Head',
      portfolioStatus: 'green',
    },
    report: {
      reportId: '11111111-1111-4111-8111-111111111111',
      periodStart: '2026-03-30T00:00:00.000Z',
      periodEnd: '2026-04-05T23:59:59.000Z',
      deadline: '2026-04-03T15:00:00.000Z',
      status: 'published',
      publishedAt: '2026-04-05T14:00:00.000Z',
      publishedById: '00000000-0000-4000-8000-000000000001',
      publishedByName: 'Department Head',
      portfolioOverview: { status: 'green', totals: { green: 3, yellow: 0, red: 0 } },
      sections: [],
    },
  },
];

test('viewer can browse report history and open a historical report in full detail', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    ({ sessionKey, archiveKey, session, archive }) => {
      window.localStorage.setItem(sessionKey, JSON.stringify(session));
      window.localStorage.setItem(archiveKey, JSON.stringify(archive));
    },
    {
      sessionKey: devSessionStorageKey,
      archiveKey: archiveStorageKey,
      session: viewerSession,
      archive: archiveReports,
    },
  );

  await page.goto('/reports/history');

  await expect(page.getByRole('heading', { name: 'Report History' })).toBeVisible();
  await expect(page.getByText('Portfolio status: yellow')).toBeVisible();
  await page.getByRole('link', { name: 'Open report' }).first().click();

  await expect(page.getByRole('heading', { name: 'Published Report' })).toBeVisible();
  await expect(page.getByText('Published by Department Head')).toBeVisible();
  await expect(page.getByText('Portfolio status: yellow')).toBeVisible();
});
