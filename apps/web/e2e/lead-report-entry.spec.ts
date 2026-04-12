import { test, expect } from './fixtures';

test.describe('Lead Report Entry', () => {
  test('lead sees My Report heading and their name', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    // Lead name is visible on the page
    await expect(leadPage.getByText('Lead 1')).toBeVisible();
  });

  test('submitted section shows read-only state with no Submit button', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    // Seed data has Lead 1 as status=submitted
    await expect(leadPage.getByText('Submitted', { exact: true })).toBeVisible();

    // No submit button when already submitted
    await expect(
      leadPage.getByRole('button', { name: 'Submit Section' }),
    ).toHaveCount(0);
  });

  test('submitted section has disabled traffic light radios', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    // Submitted sections have disabled radio buttons
    const trafficLightGroup = leadPage.getByRole('group', { name: 'Project Statuses' });
    await expect(trafficLightGroup).toBeVisible();

    // The first radio group should exist and its radios should be disabled
    const firstRadioGroup = trafficLightGroup.getByRole('radiogroup').first();
    await expect(firstRadioGroup).toBeVisible();

    // Check that the green radio is checked (from seed data) and disabled
    const greenRadio = firstRadioGroup.getByRole('radio', { name: /green/i });
    await expect(greenRadio).toBeChecked();
    await expect(greenRadio).toBeDisabled();
  });

  test('submitted section shows autosave indicator as "Section submitted"', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    await expect(leadPage.getByText('Section submitted')).toBeVisible();
  });

  test('lead report shows Project Statuses group with radio controls', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    // Project Statuses group
    const projectStatuses = leadPage.getByRole('group', { name: 'Project Statuses' });
    await expect(projectStatuses).toBeVisible();

    // First project has a radiogroup with traffic light options
    const firstRadioGroup = projectStatuses.getByRole('radiogroup').first();
    await expect(firstRadioGroup).toBeVisible();

    // Verify all four traffic light options exist
    await expect(firstRadioGroup.getByRole('radio', { name: /green/i })).toBeVisible();
    await expect(firstRadioGroup.getByRole('radio', { name: /yellow/i })).toBeVisible();
    await expect(firstRadioGroup.getByRole('radio', { name: /red/i })).toBeVisible();
    await expect(firstRadioGroup.getByRole('radio', { name: /no status/i })).toBeVisible();
  });

  test('lead report shows Items, Risks, Decisions, and Top 3 Priorities groups', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    // All editor groups should be present
    await expect(leadPage.getByRole('group', { name: 'Items' })).toBeVisible();
    await expect(leadPage.getByRole('group', { name: 'Risks' })).toBeVisible();
    await expect(leadPage.getByRole('group', { name: 'Decisions' })).toBeVisible();
    await expect(leadPage.getByRole('group', { name: 'Top 3 Priorities' })).toBeVisible();
  });

  test('lead report has priority textboxes', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible({ timeout: 30_000 });

    // Priority inputs exist
    await expect(leadPage.getByRole('textbox', { name: 'Priority 1' })).toBeVisible();
    await expect(leadPage.getByRole('textbox', { name: 'Priority 2' })).toBeVisible();
    await expect(leadPage.getByRole('textbox', { name: 'Priority 3' })).toBeVisible();
  });
});
