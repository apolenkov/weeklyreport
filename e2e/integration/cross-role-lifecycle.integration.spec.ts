/**
 * Cross-role lifecycle integration tests.
 *
 * Drives two browser contexts (lead + head) through:
 *   submit -> publish -> locked-for-lead -> revoke -> re-edit
 *
 * The fixtures don't help here — we need two contexts simultaneously, so the
 * tests create them inline via `loginAs(context, ...)`.
 */

import { expect, loginAs, test } from "./fixtures";
import { prisma, resetMutations } from "./helpers/db";
import {
  ACTIVE_REPORT_ID,
  LEAD_OLGA_ID,
  SEED_EMAILS,
} from "./helpers/seed-ids";

test.describe("Cross-role lifecycle (integration)", () => {
  test.afterEach(async () => {
    await resetMutations();
  });

  test("lead UI reflects a published period as locked", async ({
    browser,
  }) => {
    const leadCtx = await browser.newContext();
    const leadPage = await leadCtx.newPage();
    await loginAs(leadCtx, { role: "lead", email: SEED_EMAILS.olga });

    const headCtx = await browser.newContext();
    const headPage = await headCtx.newPage();
    await loginAs(headCtx, { role: "head" });

    const sectionBefore = await prisma.reportSection.findUnique({
      where: {
        reportId_authorId: {
          reportId: ACTIVE_REPORT_ID,
          authorId: LEAD_OLGA_ID,
        },
      },
    });
    expect(sectionBefore?.status).toBe("draft");
    const submittedBefore = await prisma.reportSection.count({
      where: { reportId: ACTIVE_REPORT_ID, status: "submitted" },
    });

    // 1. Lead submits via DB (UI submit covered by lead-journey spec).
    await prisma.reportSection.update({
      where: {
        reportId_authorId: {
          reportId: ACTIVE_REPORT_ID,
          authorId: LEAD_OLGA_ID,
        },
      },
      data: { status: "submitted", submittedAt: new Date() },
    });

    // 2. Head sees submission count via DB truth.
    await headPage.goto("/head/dashboard");
    const submittedCount = await prisma.reportSection.count({
      where: { reportId: ACTIVE_REPORT_ID, status: "submitted" },
    });
    expect(submittedCount).toBe(submittedBefore + 1);

    // 3. Head publishes via DB (UI publish covered by head-journey spec).
    await prisma.report.update({
      where: { id: ACTIVE_REPORT_ID },
      data: {
        status: "published",
        periodState: "published",
        periodStatus: "published",
        publishedAt: new Date(),
        publishedById: "a0000000-0000-4000-8000-000000000099",
      },
    });

    // 4. Lead refreshes — UI must reflect locked state.
    await leadPage.goto("/lead/report");
    await expect(
      leadPage.getByRole("heading", { name: "My Report" }),
    ).toBeVisible();
    await expect(
      leadPage.getByRole("button", { name: "Submit", exact: true }),
    ).toHaveCount(0);
    const report = await prisma.report.findUnique({
      where: { id: ACTIVE_REPORT_ID },
    });
    expect(report?.status).toBe("published");

    await leadCtx.close();
    await headCtx.close();
  });

  test("lead UI refreshes published state on the next navigation", async ({
    browser,
  }) => {
    const leadCtx = await browser.newContext();
    const leadPage = await leadCtx.newPage();
    await loginAs(leadCtx, { role: "lead", email: SEED_EMAILS.olga });

    await leadPage.goto("/lead/report");
    await expect(
      leadPage.getByRole("button", { name: "Submit", exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    // Simulate head publishing while lead is on page.
    await prisma.report.update({
      where: { id: ACTIVE_REPORT_ID },
      data: {
        status: "published",
        periodState: "published",
        periodStatus: "published",
        publishedAt: new Date(),
        publishedById: "a0000000-0000-4000-8000-000000000099",
      },
    });

    // Lead navigates — should see fresh state.
    await leadPage.reload();
    await expect(
      leadPage.getByRole("heading", { name: "My Report" }),
    ).toBeVisible();
    await expect(
      leadPage.getByRole("button", { name: "Submit", exact: true }),
    ).toHaveCount(0);

    const report = await prisma.report.findUnique({
      where: { id: ACTIVE_REPORT_ID },
    });
    expect(report?.status).toBe("published");

    await leadCtx.close();
  });

  test("lead UI becomes editable after a report returns to draft", async ({
    browser,
  }) => {
    // Pre-publish.
    await prisma.report.update({
      where: { id: ACTIVE_REPORT_ID },
      data: {
        status: "published",
        periodState: "published",
        periodStatus: "published",
        publishedAt: new Date(),
        publishedById: "a0000000-0000-4000-8000-000000000099",
      },
    });

    // Revoke.
    await prisma.report.update({
      where: { id: ACTIVE_REPORT_ID },
      data: {
        status: "draft",
        archived: false,
        periodState: "open",
        periodStatus: "open",
        publishedAt: null,
        publishedById: null,
      },
    });

    const leadCtx = await browser.newContext();
    const leadPage = await leadCtx.newPage();
    await loginAs(leadCtx, { role: "lead", email: SEED_EMAILS.olga });
    await leadPage.goto("/lead/report");
    const submitButton = leadPage.getByRole("button", {
      name: "Submit",
      exact: true,
    });
    await expect(submitButton).toBeVisible({ timeout: 15_000 });
    await expect(submitButton).toBeEnabled();

    const report = await prisma.report.findUnique({
      where: { id: ACTIVE_REPORT_ID },
    });
    expect(report?.status).toBe("draft");

    await leadCtx.close();
  });
});
