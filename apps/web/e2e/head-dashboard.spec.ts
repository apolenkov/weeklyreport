import { test, expect } from './fixtures';
import { submitSection } from './helpers/test-utils';

test('lead users are blocked from the head dashboard route', async ({ leadPage }) => {
  await leadPage.goto('/head/dashboard');

  // Lead accessing head dashboard should see access denied or redirect
  // The page still renders the heading but shows access denied message
  await expect(
    leadPage.getByText(/access denied|do not have permission|FORBIDDEN/i),
  ).toBeVisible({ timeout: 15_000 });
});

test('head dashboard shows lead submissions with status', async ({ headPage }) => {
  await headPage.goto('/head/dashboard');

  await expect(headPage.getByRole('heading', { name: 'Review Dashboard', level: 1 })).toBeVisible();

  // Submission dashboard table should be visible
  await expect(
    headPage.getByRole('table', { name: 'Submission dashboard' }),
  ).toBeVisible();

  // Dashboard shows lead submission statuses
  await expect(
    headPage.getByRole('cell', { name: /Submitted|Draft/i }).first(),
  ).toBeVisible();

  // Progress text shows "N of M leads submitted"
  await expect(
    headPage.getByText(/\d+ of \d+ leads submitted/),
  ).toBeVisible();

  // Link to assembled report should be visible
  await expect(
    headPage.getByRole('link', { name: 'Open assembled report' }),
  ).toBeVisible();
});

test('head dashboard reflects lead submission after submit succeeds', async ({ headPage, leadPage }) => {
  // As lead, submit section
  await leadPage.goto('/lead/report');
  await expect(leadPage.getByRole('heading', { name: 'My Report', level: 1 })).toBeVisible();

  const submitButton = leadPage.getByRole('button', { name: 'Submit Section' });
  const isDraft = await submitButton.isVisible().catch(() => false);

  if (isDraft) {
    // Fill traffic light for first project
    const trafficLightGroup = leadPage.getByRole('group', { name: 'Project Statuses' });
    const firstRadioGroup = trafficLightGroup.getByRole('radiogroup').first();
    await firstRadioGroup.getByRole('radio', { name: /green/i }).click();

    await submitSection(leadPage);
  }

  // As head, check dashboard shows submission
  await headPage.goto('/head/dashboard');
  await expect(headPage.getByRole('heading', { name: 'Review Dashboard', level: 1 })).toBeVisible();

  const leadOneRow = headPage.getByRole('row').filter({ hasText: 'Lead 1' });
  await expect(leadOneRow).toContainText(/submitted/i);
});
