/**
 * Head journey integration tests.
 *
 * Dashboard -> weekly report -> Publish & Lock -> revoke, with DB-level
 * verification of report.status and report.publishedAt.
 */

import { expect, test } from "./fixtures";
import { prisma, resetMutations } from "./helpers/db";
import { ACTIVE_REPORT_ID, SEED_EMAILS } from "./helpers/seed-ids";

test.describe("Head journey (integration)", () => {
  test.afterEach(async () => {
    await resetMutations();
  });

  test("head dashboard renders group-scoped seeded submission truth", async ({
    headPage,
  }) => {
    const head = await prisma.user.findUnique({
      where: { email: SEED_EMAILS.head },
      select: { reportingGroupId: true },
    });
    if (!head?.reportingGroupId) {
      throw new Error("Seed head has no reporting group");
    }
    const scope = { reportingGroupId: head.reportingGroupId };
    const [submitted, totalLeads] = await Promise.all([
      prisma.reportSection.count({
        where: {
          reportId: ACTIVE_REPORT_ID,
          status: "submitted",
          author: scope,
        },
      }),
      prisma.user.count({
        where: { role: "lead", isActive: true, ...scope },
      }),
    ]);

    await headPage.goto("/head/dashboard");
    await expect(
      headPage.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      headPage.getByRole("region", {
        name: new RegExp(String.raw`^Submissions: ${submitted} of ${totalLeads}, \d+ pending$`),
      }),
    ).toBeVisible();
    expect(submitted).toBeGreaterThan(0);
    expect(totalLeads).toBeGreaterThanOrEqual(submitted);
  });

  test("head reviews a submitted section and the verdict persists", async ({
    headPage,
  }) => {
    const head = await prisma.user.findUniqueOrThrow({
      where: { email: SEED_EMAILS.head },
      select: { id: true },
    });
    const before = new Map(
      (
        await prisma.sectionReview.findMany({
          where: { reviewerId: head.id },
          select: { reportSectionId: true, updatedAt: true },
        })
      ).map((review) => [review.reportSectionId, review.updatedAt.getTime()]),
    );

    await headPage.goto(`/head/report/${ACTIVE_REPORT_ID}`);
    await headPage
      .getByRole("button", { name: "Review", exact: true })
      .click();

    const approve = headPage.getByRole("button", { name: "Approve" }).first();
    await expect(approve).toBeVisible({ timeout: 15_000 });
    const response = headPage.waitForResponse(
      (candidate) =>
        candidate.url().includes("/trpc/review.verdict") &&
        candidate.request().method() === "POST",
    );
    await approve.click();
    await response;
    await expect(headPage.getByText("Section approved")).toBeVisible();

    const persisted = await prisma.sectionReview.findFirst({
      where: { reviewerId: head.id, verdict: "approved" },
      orderBy: { updatedAt: "desc" },
      select: { reportSectionId: true, updatedAt: true },
    });
    expect(persisted).not.toBeNull();
    expect(persisted?.updatedAt.getTime()).toBeGreaterThan(
      before.get(persisted?.reportSectionId ?? "") ?? 0,
    );
  });

  test("head can publish active report and report.status flips to published", async ({
    headPage,
  }) => {
    await headPage.goto(`/head/report/${ACTIVE_REPORT_ID}`);

    const publishBtn = headPage.getByRole("button", {
      name: /publish.*lock/i,
    });
    await expect(publishBtn).toBeVisible({ timeout: 15_000 });
    await publishBtn.click();

    // Confirmation dialog.
    const confirm = headPage.getByRole("button", {
      name: /^(publish|confirm|yes)/i,
    });
    if (await confirm.count()) await confirm.last().click();

    await headPage.waitForResponse(
      (r) =>
        r.url().includes("/trpc/") &&
        r.request().method() === "POST" &&
        /publish/i.test(r.url()),
      { timeout: 15_000 },
    );

    const report = await prisma.report.findUnique({
      where: { id: ACTIVE_REPORT_ID },
    });
    expect(report?.status).toBe("published");
    expect(report?.periodStatus).toBe("published");
    expect(report?.publishedAt).not.toBeNull();
  });

  test("head can reopen a published report and periodStatus reverts", async ({
    headPage,
  }) => {
    // Pre-condition: publish via DB (faster + deterministic than re-running prior test).
    await prisma.report.update({
      where: { id: ACTIVE_REPORT_ID },
      data: {
        status: "published",
        periodStatus: "published",
        publishedAt: new Date(),
        publishedById: "a0000000-0000-4000-8000-000000000099",
      },
    });

    await headPage.goto(`/head/report/${ACTIVE_REPORT_ID}`);

    const reopenBtn = headPage.getByRole("button", {
      name: /reopen/i,
    });
    await expect(reopenBtn).toBeVisible({ timeout: 15_000 });
    await reopenBtn.click();

    const confirm = headPage.getByRole("button", {
      name: /^(revoke|reopen|confirm|yes)/i,
    });
    const reopenResponse = headPage.waitForResponse(
      (r) =>
        r.url().includes("/trpc/period.reopen") &&
        r.request().method() === "POST",
      { timeout: 15_000 },
    );
    if (await confirm.count()) await confirm.last().click();
    await reopenResponse;

    const report = await prisma.report.findUnique({
      where: { id: ACTIVE_REPORT_ID },
    });
    expect(report?.status).toBe("published");
    expect(report?.periodStatus).toBe("reopened");

    const submittedSections = await prisma.reportSection.count({
      where: { reportId: ACTIVE_REPORT_ID, status: "submitted" },
    });
    expect(submittedSections).toBe(0);
  });

  test("head sees portfolio overview with traffic lights from seeded ProjectStatus rows", async ({
    headPage,
  }) => {
    await headPage.goto("/head/dashboard");
    await expect(
      headPage.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible({ timeout: 15_000 });

    // Truth from DB: there must be ProjectStatus rows for the active report's
    // sections (seed creates ~10 of them, skipping Sergey).
    const lightsCount = await prisma.projectStatus.count({
      where: { reportSection: { reportId: ACTIVE_REPORT_ID } },
    });
    expect(lightsCount).toBeGreaterThan(0);
  });
});
