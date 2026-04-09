import { expect, test } from '@playwright/test';

const devSessionStorageKey = 'customreport:dev-session';
const adminSnapshotStorageKey = 'customreport:admin-snapshot';
const leadReportStorageKey = 'customreport:lead-report-section';

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

const sourceLeadSection = {
  reportSectionId: '11111111-1111-4111-8111-111111111111',
  reportId: '22222222-2222-4222-8222-222222222222',
  authorId: '33333333-3333-4333-8333-333333333333',
  authorName: 'Lead 1',
  status: 'draft',
  submittedAt: null,
  projects: [
    {
      projectId: '44444444-4444-4444-8444-444444444444',
      projectName: 'Project 1',
      trafficLight: 'yellow',
    },
  ],
  items: [
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      projectId: '44444444-4444-4444-8444-444444444444',
      type: 'next',
      text: 'Carried from previous report',
      tag: 'feature',
      workflowStatus: 'in_progress',
      carriedOver: false,
      completed: null,
    },
  ],
  risks: [],
  decisions: [
    {
      id: '99999999-9999-4999-8999-999999999999',
      text: 'Still unresolved',
      owner: 'Department Head',
      deadline: null,
      impact: 'Needs action',
      resolvedAt: null,
    },
  ],
  priorities: [
    { rank: 1, text: 'Priority 1' },
    { rank: 2, text: 'Priority 2' },
    { rank: 3, text: 'Priority 3' },
  ],
};

test('carry-over surfaces once in the next-period lead form and does not duplicate on replay', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    ({ sessionKey, snapshotKey, sectionKey, session, sourceSection }) => {
      window.localStorage.removeItem(snapshotKey);
      window.localStorage.setItem(sessionKey, JSON.stringify(session));
      window.localStorage.setItem(sectionKey, JSON.stringify(sourceSection));
    },
    {
      sessionKey: devSessionStorageKey,
      snapshotKey: adminSnapshotStorageKey,
      sectionKey: leadReportStorageKey,
      session: headSession,
      sourceSection: sourceLeadSection,
    },
  );

  await page.goto('/admin');
  await page.getByRole('button', { name: 'Run carry-over' }).click();
  await expect(page.getByText('Carry-over completed')).toBeVisible();
  await page.getByRole('button', { name: 'Run carry-over' }).click();

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

  await expect(page.getByText('Carried over from previous report')).toBeVisible();
  await expect(page.getByText('Unresolved decision')).toBeVisible();
  await expect(page.getByLabel('Current item 1')).toHaveValue('Carried from previous report');
  await page.getByLabel('Carry-over item 1 completed').click();
  await expect(page.getByText('Сохранено')).toBeVisible();
});
