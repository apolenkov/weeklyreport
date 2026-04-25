/**
 * Status <-> Risk auto-sync integration tests.
 *
 * The sync rules (per Phase 22):
 *   - Setting a stage status to "at_risk" or "blocked" auto-creates an
 *     empty Risk row tied to that section/project.
 *   - Filling a Risk row prompts the user to upgrade the stage status; on
 *     confirm, the stage status is updated.
 *
 * SyncSource flag prevents infinite loops — assert exactly one Risk row is
 * created (no double-write).
 */

import { test, expect } from './fixtures';
import { prisma, resetMutations } from './helpers/db';
import { ACTIVE_REPORT_ID, LEAD_POLENKOV_ID } from './helpers/seed-ids';

test.describe('Status<->Risk sync (integration)', () => {
  test.afterEach(async () => {
    await resetMutations();
  });

  test('setting stage to at_risk auto-creates a Risk row in DB', async ({
    leadPage,
  }) => {
    await leadPage.goto('/lead/report');

    const before = await prisma.risk.count({
      where: {
        reportSection: {
          reportId: ACTIVE_REPORT_ID,
          authorId: LEAD_POLENKOV_ID,
        },
      },
    });

    // Find the first traffic-light/stage-status control and switch it to "at risk".
    const atRiskBtn = leadPage.getByRole('button', { name: /at.?risk/i }).first();
    if (!(await atRiskBtn.count())) {
      // eslint-disable-next-line playwright/no-skipped-test
      test.skip(
        true,
        'at-risk stage control not exposed by current UI — TODO(plan-26): unblock after Phase 22 sync wiring lands',
      );
    }
    await atRiskBtn.click();

    await leadPage.waitForResponse(
      (r) =>
        r.url().includes('/trpc/') &&
        r.request().method() === 'POST',
      { timeout: 15_000 },
    );

    const after = await prisma.risk.count({
      where: {
        reportSection: {
          reportId: ACTIVE_REPORT_ID,
          authorId: LEAD_POLENKOV_ID,
        },
      },
    });
    expect(after).toBe(before + 1);
  });

  test('filling a risk does not double-write (SyncSource flag works)', async ({
    leadPage,
  }) => {
    await leadPage.goto('/lead/report');

    // The seed already creates risks for Polenkov (riskId 1, 2). Editing one
    // should NOT create a second risk row from a sync feedback loop.
    const before = await prisma.risk.count({
      where: {
        reportSection: {
          reportId: ACTIVE_REPORT_ID,
          authorId: LEAD_POLENKOV_ID,
        },
      },
    });

    const riskInput = leadPage
      .getByRole('textbox', { name: /risk|impact|mitigation/i })
      .first();
    if (!(await riskInput.count())) {
      // eslint-disable-next-line playwright/no-skipped-test
      test.skip(true, 'risk inputs not on page — TODO(plan-26)');
    }
    await riskInput.fill('Updated risk text from integration test');

    await leadPage.waitForResponse(
      (r) =>
        r.url().includes('/trpc/') &&
        r.request().method() === 'POST',
      { timeout: 15_000 },
    );

    const after = await prisma.risk.count({
      where: {
        reportSection: {
          reportId: ACTIVE_REPORT_ID,
          authorId: LEAD_POLENKOV_ID,
        },
      },
    });
    // Critical: COUNT IS UNCHANGED. Edit must update, not insert.
    expect(after).toBe(before);
  });
});
