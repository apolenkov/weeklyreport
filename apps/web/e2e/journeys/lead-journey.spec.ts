import { test, expect } from '../fixtures';

test.describe('Lead Journey', () => {
  test('lead sees report form with all sections and correct status', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    // Verify lead name and status
    await expect(leadPage.getByText('Lead 1')).toBeVisible();
    await expect(
      leadPage.getByText('Submitted', { exact: true }).or(leadPage.getByText('Draft', { exact: true })),
    ).toBeVisible();

    // Verify form sections
    await expect(leadPage.getByRole('group', { name: 'Project Statuses' })).toBeVisible();
    await expect(leadPage.getByRole('group', { name: 'Items' })).toBeVisible();
    await expect(leadPage.getByRole('group', { name: 'Risks' })).toBeVisible();
    await expect(leadPage.getByRole('group', { name: 'Decisions' })).toBeVisible();
    await expect(leadPage.getByRole('group', { name: 'Top 3 Priorities' })).toBeVisible();

    // Verify traffic light radios
    const trafficLightGroup = leadPage.getByRole('group', { name: 'Project Statuses' });
    const firstRadioGroup = trafficLightGroup.getByRole('radiogroup').first();
    await expect(firstRadioGroup.getByRole('radio', { name: /green/i })).toBeVisible();

    // Verify priority textboxes
    await expect(leadPage.getByRole('textbox', { name: 'Priority 1' })).toBeVisible();
    await expect(leadPage.getByRole('textbox', { name: 'Priority 2' })).toBeVisible();
    await expect(leadPage.getByRole('textbox', { name: 'Priority 3' })).toBeVisible();
  });

  test('submitted section is read-only with no Submit button', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    // Seed data has Lead 1 as submitted
    const isSubmitted = await leadPage
      .getByText('Submitted', { exact: true })
      .isVisible()
      .catch(() => false);

    if (isSubmitted) {
      // Submit button should not be present
      await expect(
        leadPage.getByRole('button', { name: 'Submit Section' }),
      ).toHaveCount(0);

      // Autosave indicator shows "Section submitted"
      await expect(leadPage.getByText('Section submitted')).toBeVisible();
    }
  });
});
