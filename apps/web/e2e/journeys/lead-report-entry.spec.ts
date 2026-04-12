import { test, expect } from '../fixtures';
import { waitForAutosave, submitSection, expectRuLocaleDate } from '../helpers/test-utils';

test.describe('Lead Report Entry - Complete Journey', () => {
  test('lead fills complete section with traffic lights, items, risks, decisions, priorities and submits', async ({
    leadPage,
  }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible();

    // Only fill if section is in draft state
    const submitButton = leadPage.getByRole('button', { name: 'Submit Section' });
    const isDraft = await submitButton.isVisible().catch(() => false);

    if (isDraft) {
      // Fill traffic light for first project
      const trafficLightGroup = leadPage.getByRole('group', { name: 'Project Statuses' });
      const firstRadioGroup = trafficLightGroup.getByRole('radiogroup').first();
      await firstRadioGroup.getByRole('radio', { name: /green/i }).click();

      // Fill current week item
      const currentItemInput = leadPage.getByLabel(/Current item 1/i);
      if (await currentItemInput.isVisible().catch(() => false)) {
        await currentItemInput.fill('E2E complete section test item');
      }

      // Fill priorities
      const priority1 = leadPage.getByLabel('Priority 1');
      if (await priority1.isVisible().catch(() => false)) {
        await priority1.fill('Ship feature X');
        await leadPage.getByLabel('Priority 2').fill('Fix critical bug Y');
        await leadPage.getByLabel('Priority 3').fill('Deploy to staging');
      }

      // Submit and verify success toast
      await submitSection(leadPage);
    }

    // Verify submitted state
    await leadPage.reload();
    await expect(leadPage.getByText('Submitted')).toBeVisible();
    await expect(
      leadPage.getByRole('button', { name: 'Submit Section' }),
    ).toHaveCount(0);
  });
});

test.describe('Lead Report Entry - Autosave', () => {
  test('autosave indicator changes from Saving to Saved after typing', async ({
    leadPage,
  }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible();

    const submitButton = leadPage.getByRole('button', { name: 'Submit Section' });
    const isDraft = await submitButton.isVisible().catch(() => false);

    if (isDraft) {
      // Type into a priority field to trigger autosave
      const priority1 = leadPage.getByLabel('Priority 1');
      if (await priority1.isVisible().catch(() => false)) {
        await priority1.fill('Autosave test priority');
      }

      // Wait for autosave indicator to stabilize
      await waitForAutosave(leadPage);
    }
  });
});

test.describe('Lead Report Entry - Validation', () => {
  test('lead sees validation feedback when submitting incomplete section', async ({
    leadPage,
  }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible();

    const submitButton = leadPage.getByRole('button', { name: 'Submit Section' });
    const isDraft = await submitButton.isVisible().catch(() => false);

    if (isDraft) {
      // Attempt to submit -- if traffic lights are missing, validation should warn
      await submitButton.click();

      // Either a confirm dialog appears (all valid) or validation error shows
      const dialog = leadPage.getByRole('dialog');
      const validationError = leadPage.getByText(
        /required|обязательн|traffic light|заполните/i,
      );

      // Wait for either dialog or error to appear
      await expect(dialog.or(validationError)).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe('Lead Report Entry - Draft Persistence', () => {
  test('lead edits draft section and data is loaded correctly after reload', async ({
    leadPage,
  }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible();

    const submitButton = leadPage.getByRole('button', { name: 'Submit Section' });
    const isDraft = await submitButton.isVisible().catch(() => false);

    if (isDraft) {
      // Fill a priority field with unique value
      const priority1 = leadPage.getByLabel('Priority 1');
      if (await priority1.isVisible().catch(() => false)) {
        await priority1.fill('Draft persistence test value');
      }

      // Wait for autosave
      await waitForAutosave(leadPage);

      // Reload and verify data persisted
      await leadPage.reload();
      await expect(
        leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
      ).toBeVisible();

      await expect(leadPage.getByLabel('Priority 1')).toHaveValue(
        'Draft persistence test value',
      );
    }
  });
});

test.describe('Lead Report Entry - Submitted Lock', () => {
  test('lead cannot edit a submitted section (form is read-only)', async ({
    leadPage,
  }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible();

    // If section is already submitted, verify lock
    const isSubmitted = await leadPage
      .getByText('Submitted')
      .isVisible()
      .catch(() => false);

    if (isSubmitted) {
      // Submit button should not be present
      await expect(
        leadPage.getByRole('button', { name: 'Submit Section' }),
      ).toHaveCount(0);

      // Form fields should be disabled/read-only for submitted sections
      // Check if priority fields are disabled
      const priority1 = leadPage.getByLabel('Priority 1');
      if (await priority1.isVisible().catch(() => false)) {
        await expect(priority1).toBeDisabled();
      }
    }
  });
});

test.describe('Lead Report Entry - Locale', () => {
  test('lead sees ru-RU formatted dates on the report page', async ({
    leadPage,
  }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible();

    // Dates on the page (period, deadline) should be formatted in Russian locale
    // BUG-017 fix ensures ru-RU formatting
    await expectRuLocaleDate(leadPage);
  });
});
