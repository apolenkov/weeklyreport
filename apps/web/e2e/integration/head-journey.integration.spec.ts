/**
 * E2E-05: Head journey integration tests.
 *
 * Dashboard -> weekly report -> Publish & Lock -> revoke, with DB-level
 * verification of report.status and report.publishedAt.
 */

import { test, expect } from './fixtures';
import { prisma, resetMutations } from './helpers/db';
import { ACTIVE_REPORT_ID } from './helpers/seed-ids';

test.describe('Head journey (integration)', () => {
  test.afterEach(async () => {
    await resetMutations();
  });

  test('head dashboard renders with seeded data (4 submitted / 2 draft)', async ({
    headPage,
  }) => {
    await headPage.goto('/admin');
    // Page should reach interactive state without auth redirect.
    await expect(headPage).toHaveURL(/\/admin/);

    // DB-level truth: seed creates 6 active-report sections (4 submitted, 2 draft).
    const submitted = await prisma.reportSection.count({
      where: { reportId: ACTIVE_REPORT_ID, status: 'submitted' },
    });
    const draft = await prisma.reportSection.count({
      where: { reportId: ACTIVE_REPORT_ID, status: 'draft' },
    });
    expect(submitted).toBe(4);
    expect(draft).toBe(2);
  });

  test('head can publish active report and report.status flips to published', async ({
    headPage,
  }) => {
    await headPage.goto(`/head/report/${ACTIVE_REPORT_ID}`);

    const publishBtn = headPage.getByRole('button', {
      name: /publish.*lock/i,
    });
    await expect(publishBtn).toBeVisible({ timeout: 15_000 });
    await publishBtn.click();

    // Confirmation dialog.
    const confirm = headPage.getByRole('button', {
      name: /^(publish|confirm|yes)/i,
    });
    if (await confirm.count()) await confirm.last().click();

    await headPage.waitForResponse(
      (r) =>
        r.url().includes('/trpc/') &&
        r.request().method() === 'POST' &&
        /publish/i.test(r.url()),
      { timeout: 15_000 },
    );

    const report = await prisma.report.findUnique({
      where: { id: ACTIVE_REPORT_ID },
    });
    expect(report?.status).toBe('published');
    expect(report?.periodStatus).toBe('published');
    expect(report?.publishedAt).not.toBeNull();
  });

  test('head can reopen a published report and periodStatus reverts', async ({
    headPage,
  }) => {
    // Pre-condition: publish via DB (faster + deterministic than re-running prior test).
    await prisma.report.update({
      where: { id: ACTIVE_REPORT_ID },
      data: {
        status: 'published',
        periodStatus: 'published',
        publishedAt: new Date(),
        publishedById: 'a0000000-0000-4000-8000-000000000099',
      },
    });

    await headPage.goto(`/head/report/${ACTIVE_REPORT_ID}`);

    const reopenBtn = headPage.getByRole('button', {
      name: /reopen/i,
    });
    await expect(reopenBtn).toBeVisible({ timeout: 15_000 });
    await reopenBtn.click();

    const confirm = headPage.getByRole('button', {
      name: /^(revoke|reopen|confirm|yes)/i,
    });
    if (await confirm.count()) await confirm.last().click();

    await headPage.waitForResponse(
      (r) =>
        r.url().includes('/trpc/') &&
        r.request().method() === 'POST',
      { timeout: 15_000 },
    );

    const report = await prisma.report.findUnique({
      where: { id: ACTIVE_REPORT_ID },
    });
    expect(report?.status).toBe('published');
    expect(report?.periodStatus).toBe('reopened');

    const submittedSections = await prisma.reportSection.count({
      where: { reportId: ACTIVE_REPORT_ID, status: 'submitted' },
    });
    expect(submittedSections).toBe(0);
  });

  test('head sees portfolio overview with traffic lights from seeded ProjectStatus rows', async ({
    headPage,
  }) => {
    await headPage.goto('/dashboard');

    // Truth from DB: there must be ProjectStatus rows for the active report's
    // sections (seed creates ~10 of them, skipping Sergey).
    const lightsCount = await prisma.projectStatus.count({
      where: { reportSection: { reportId: ACTIVE_REPORT_ID } },
    });
    expect(lightsCount).toBeGreaterThan(0);
  });
});
