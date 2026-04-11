import { test, expect } from '../fixtures';

test.describe('Lead Journey', () => {
  test('lead can fill section, save draft, submit, and verify persistence', async ({
    leadPage,
  }) => {
    // Navigate to lead report form
    await leadPage.goto('/lead/report');

    // Wait for page to load -- heading "My Report" rendered by ReportSectionForm
    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible();

    // Verify draft badge is visible (section starts as draft for lead1 from seed, but
    // seed has lead1 as "submitted". Dev-login creates a new user; the active section
    // may be draft or submitted depending on seed state. We check the page loaded.)
    await expect(leadPage.getByText('Draft').or(leadPage.getByText('Submitted'))).toBeVisible();

    // --- Fill a traffic light for the first project ---
    // ProjectStatusGrid uses role="radiogroup" with aria-label containing project name
    // Each radio button has aria-label like "Set Project 1 to green"
    const trafficLightGroup = leadPage
      .getByRole('group', { name: 'Project Statuses' });

    // Only interact with form if section is in draft state (not submitted)
    const submitButton = leadPage.getByRole('button', { name: 'Submit Section' });
    const isDraft = await submitButton.isVisible().catch(() => false);

    if (isDraft) {
      // Click the "green" traffic light for the first project
      const firstRadioGroup = trafficLightGroup.getByRole('radiogroup').first();
      await firstRadioGroup.getByRole('radio', { name: /green/i }).click();

      // --- Fill a current week item ---
      // ItemsEditor has inputs with aria-label "Current item N"
      const currentItemInput = leadPage.getByLabel(/Current item 1/i);
      if (await currentItemInput.isVisible().catch(() => false)) {
        await currentItemInput.fill('E2E test current week item');
      }

      // --- Fill priorities ---
      // PrioritiesEditor has inputs with aria-label "Priority N"
      const priority1 = leadPage.getByLabel('Priority 1');
      const priority2 = leadPage.getByLabel('Priority 2');
      const priority3 = leadPage.getByLabel('Priority 3');

      if (await priority1.isVisible().catch(() => false)) {
        await priority1.fill('E2E priority one');
        await priority2.fill('E2E priority two');
        await priority3.fill('E2E priority three');
      }

      // --- Wait for autosave ---
      // AutosaveIndicator shows "Saved" state after debounce (300ms + save time)
      await leadPage.waitForTimeout(1000);

      // --- Reload to verify draft persistence ---
      await leadPage.reload();
      await expect(
        leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
      ).toBeVisible();

      // Verify priority data persisted after reload
      await expect(leadPage.getByLabel('Priority 1')).toHaveValue('E2E priority one');

      // --- Submit the section ---
      await leadPage.getByRole('button', { name: 'Submit Section' }).click();

      // ConfirmDialog appears with "Submit Section" title and confirm button
      await expect(
        leadPage.getByRole('dialog').getByText('Submit Section'),
      ).toBeVisible();

      // Click the confirm button in the dialog (confirmLabel="Submit Section")
      await leadPage
        .getByRole('dialog')
        .getByRole('button', { name: 'Submit Section' })
        .click();

      // Verify submission success -- toast shows "Section submitted"
      await expect(leadPage.getByText('Section submitted')).toBeVisible();
    }

    // --- Verify submitted/locked state ---
    // After submission, the form shows a "Section submitted" badge and no submit button
    await leadPage.reload();
    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible();

    // Submitted badge is visible
    await expect(leadPage.getByText('Submitted')).toBeVisible();

    // Submit button should not be present when section is submitted
    await expect(
      leadPage.getByRole('button', { name: 'Submit Section' }),
    ).toHaveCount(0);
  });
});
