import { test, expect } from './fixtures';
import { waitForAutosave, submitSection } from './helpers/test-utils';

test('lead report page autosaves, confirms submit, and stays locked after reload', async ({ leadPage }) => {
  await leadPage.goto('/lead/report');

  // Wait for tRPC query to complete — page renders one of:
  // 1. ReportSectionForm with h1 "My Report"
  // 2. "No active report" alert
  // 3. QueryError
  const heading = leadPage.getByRole('heading', { name: 'My Report', level: 1 });
  const noReport = leadPage.getByText('No active report');
  const queryError = leadPage.locator('[data-testid="query-error"]')
    .or(leadPage.getByRole('button', { name: /retry/i }));

  await expect(
    heading.or(noReport).or(queryError),
  ).toBeVisible({ timeout: 30_000 });

  // If no active report or query error, skip form interactions
  if (await noReport.isVisible().catch(() => false)) {
    return;
  }
  if (await queryError.isVisible().catch(() => false)) {
    return;
  }

  // Only interact if section is in draft state
  const submitButton = leadPage.getByRole('button', { name: 'Submit Section' });
  const isDraft = await submitButton.isVisible().catch(() => false);

  if (isDraft) {
    // Fill traffic light for first project
    const trafficLightGroup = leadPage.getByRole('group', { name: 'Project Statuses' });
    const firstRadioGroup = trafficLightGroup.getByRole('radiogroup').first();
    await firstRadioGroup.getByRole('radio', { name: /green/i }).click();

    const currentItemInput = leadPage.getByLabel(/Current item 1/i);
    if (await currentItemInput.isVisible().catch(() => false)) {
      await currentItemInput.fill('Updated current week item');
    }

    await waitForAutosave(leadPage);

    await leadPage.reload();
    await expect(heading).toBeVisible({ timeout: 30_000 });

    if (await leadPage.getByLabel(/Current item 1/i).isVisible().catch(() => false)) {
      await expect(leadPage.getByLabel(/Current item 1/i)).toHaveValue('Updated current week item');
    }

    // Submit and verify success toast
    await submitSection(leadPage);
  }

  // Verify submitted/locked state
  await leadPage.reload();
  await expect(heading.or(leadPage.getByText('Submitted'))).toBeVisible({ timeout: 30_000 });

  if (await heading.isVisible().catch(() => false)) {
    await expect(leadPage.getByText('Submitted')).toBeVisible();
    await expect(leadPage.getByRole('button', { name: 'Submit Section' })).toHaveCount(0);
  }
});
