import { test, expect } from '../fixtures';

test.describe('Lead Report Entry - Complete Journey', () => {
  test('lead sees report page with all form sections', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    // Verify all form groups are present
    await expect(leadPage.getByRole('group', { name: 'Project Statuses' })).toBeVisible();
    await expect(leadPage.getByRole('group', { name: 'Items' })).toBeVisible();
    await expect(leadPage.getByRole('group', { name: 'Risks' })).toBeVisible();
    await expect(leadPage.getByRole('group', { name: 'Decisions' })).toBeVisible();
    await expect(leadPage.getByRole('group', { name: 'Top 3 Priorities' })).toBeVisible();
  });
});

test.describe('Lead Report Entry - Submitted Lock', () => {
  test('lead cannot edit a submitted section (form is read-only)', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    // Seed data has Lead 1 as submitted
    await expect(leadPage.getByText('Submitted', { exact: true })).toBeVisible();

    // Submit button should not be present
    await expect(
      leadPage.getByRole('button', { name: 'Submit Section' }),
    ).toHaveCount(0);

    // Traffic light radios should be disabled
    const trafficLightGroup = leadPage.getByRole('group', { name: 'Project Statuses' });
    const firstRadioGroup = trafficLightGroup.getByRole('radiogroup').first();
    const greenRadio = firstRadioGroup.getByRole('radio', { name: /green/i });
    await expect(greenRadio).toBeDisabled();

    // Priority inputs should be disabled
    const priority1 = leadPage.getByRole('textbox', { name: 'Priority 1' });
    if (await priority1.isVisible().catch(() => false)) {
      await expect(priority1).toBeDisabled();
    }
  });
});

test.describe('Lead Report Entry - Traffic Lights', () => {
  test('project traffic light has all four status options', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    const trafficLightGroup = leadPage.getByRole('group', { name: 'Project Statuses' });
    const firstRadioGroup = trafficLightGroup.getByRole('radiogroup').first();

    await expect(firstRadioGroup.getByRole('radio', { name: /green/i })).toBeVisible();
    await expect(firstRadioGroup.getByRole('radio', { name: /yellow/i })).toBeVisible();
    await expect(firstRadioGroup.getByRole('radio', { name: /red/i })).toBeVisible();
    await expect(firstRadioGroup.getByRole('radio', { name: /no status/i })).toBeVisible();
  });

  test('submitted section has checked green radio for project 1', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    const trafficLightGroup = leadPage.getByRole('group', { name: 'Project Statuses' });
    const firstRadioGroup = trafficLightGroup.getByRole('radiogroup').first();

    // Seed data sets Project 1 to green
    await expect(firstRadioGroup.getByRole('radio', { name: /green/i })).toBeChecked();
  });
});

test.describe('Lead Report Entry - Priorities', () => {
  test('lead report has three priority textboxes', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    await expect(leadPage.getByRole('textbox', { name: 'Priority 1' })).toBeVisible();
    await expect(leadPage.getByRole('textbox', { name: 'Priority 2' })).toBeVisible();
    await expect(leadPage.getByRole('textbox', { name: 'Priority 3' })).toBeVisible();
  });
});

test.describe('Lead Report Entry - Autosave Indicator', () => {
  test('submitted section shows "Section submitted" indicator', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    await expect(leadPage.getByText('Section submitted')).toBeVisible();
  });
});
