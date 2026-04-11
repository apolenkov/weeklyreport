import { test, expect } from '../fixtures';

test.describe('PDF Export', () => {
  test('head can publish and viewer can export PDF from published report', async ({
    headPage,
    viewerPage,
  }) => {
    // --- Step 1: Ensure report is published (as head) ---
    await headPage.goto('/head/report');
    await expect(
      headPage.getByRole('heading', { name: 'Assembled Report', level: 1 }),
    ).toBeVisible();

    // Publish if not already published
    const publishButton = headPage.getByRole('button', {
      name: 'Publish Report',
    });
    const canPublish = await publishButton.isVisible().catch(() => false);

    if (canPublish) {
      await publishButton.click();
      await expect(
        headPage.getByRole('dialog').getByText('Publish Report'),
      ).toBeVisible();
      await headPage
        .getByRole('dialog')
        .getByRole('button', { name: 'Publish' })
        .click();
      await expect(headPage.getByText('Report published')).toBeVisible();
    }

    // --- Step 2: As viewer, navigate to published report ---
    const reportId = '00000000-0000-0000-0000-000000000001';
    await viewerPage.goto(`/reports/${reportId}`);

    // PublishedReport renders heading "Published Report"
    await expect(
      viewerPage.getByRole('heading', {
        name: 'Published Report',
        level: 1,
      }),
    ).toBeVisible();

    // --- Step 3: Trigger PDF export ---
    // PdfExportControls renders "Export PDF" button (outline variant)
    const exportButton = viewerPage.getByRole('button', {
      name: /Export PDF/i,
    });
    await expect(exportButton).toBeVisible();
    await exportButton.click();

    // Toast appears: "PDF export started"
    await expect(viewerPage.getByText('PDF export started')).toBeVisible();

    // --- Step 4: Wait for export completion ---
    // The button changes to "Exporting..." while processing
    // Then a "Download PDF" link appears when completed
    // Poll with extended timeout for BullMQ job processing
    const downloadLink = viewerPage.getByRole('link', {
      name: /Download PDF/i,
    });
    const exportingIndicator = viewerPage.getByText('Exporting...');

    // Wait for either download link or exporting state
    await expect(
      downloadLink.or(exportingIndicator),
    ).toBeVisible({ timeout: 30_000 });

    // If still exporting, wait for download link with extended timeout
    if (await exportingIndicator.isVisible().catch(() => false)) {
      await expect(downloadLink).toBeVisible({ timeout: 60_000 });
    }

    // --- Step 5: Verify download link has href ---
    // The download link wraps an <a> with download attribute and href to the artifact
    if (await downloadLink.isVisible().catch(() => false)) {
      await expect(downloadLink).toHaveAttribute('href', /.+/);
    }

    // Export status badge should show "completed"
    await expect(viewerPage.getByText('completed')).toBeVisible({
      timeout: 60_000,
    });
  });
});
